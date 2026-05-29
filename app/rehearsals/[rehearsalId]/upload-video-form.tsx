"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
  UploadSessionRequest,
  UploadSessionResponse,
} from "@/lib/api/contracts";
import {
  uploadResumable,
  UploadAbortedError,
  UploadSessionExpiredError,
  type UploadProgress,
} from "@/lib/upload/resumable-uploader";

type UploadVideoFormProps = {
  rehearsalId: string;
  submitLabel?: string;
  pendingLabel?: string;
  onCompleted?: () => void;
};

type Phase = "idle" | "preparing" | "uploading" | "finalizing" | "done";

const MB = 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "—";
  if (bytesPerSec < MB) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / MB).toFixed(1)} MB/s`;
}

function formatEta(remainingBytes: number, bytesPerSec: number): string {
  if (bytesPerSec <= 0 || remainingBytes <= 0) return "—";
  const seconds = remainingBytes / bytesPerSec;
  if (seconds < 60) return `~${Math.ceil(seconds)}s left`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min left`;
  return `~${Math.ceil(seconds / 3600)} h left`;
}

function messageForUploadError(err: unknown): string {
  if (err instanceof UploadAbortedError) {
    return "Upload cancelled.";
  }
  if (err instanceof UploadSessionExpiredError) {
    return "Upload session expired. Please try again.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

export function UploadVideoForm({
  rehearsalId,
  submitLabel = "Upload video",
  pendingLabel = "Uploading...",
  onCompleted,
}: UploadVideoFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  // Cancel any in-flight upload if the user navigates away (closes the
  // dialog, leaves the page). The DB row will sit at UPLOADING until the
  // 24 h sweeper reaps it — matches the recover-or-delete semantics.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const isBusy = phase !== "idle" && phase !== "done";

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please choose a video file.");
      return;
    }

    setError(null);
    setProgress(null);
    setPhase("preparing");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. Open a resumable session. Server creates the VideoAsset row
      //    and asks GCS for a session URI good for ~7 days.
      const sessionReqBody: UploadSessionRequest = {
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        fileSizeBytes: selectedFile.size,
      };

      const sessionResp = await fetch(
        `/api/rehearsals/${rehearsalId}/video/upload-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionReqBody),
          signal: controller.signal,
        }
      );

      const sessionData = (await sessionResp.json()) as UploadSessionResponse;
      if (!sessionData.ok) {
        throw new Error(sessionData.error.message);
      }

      // 2. Stream chunks directly to GCS. Progress is reported per chunk
      //    via XHR.upload.onprogress so the UI doesn't sit silent.
      setPhase("uploading");
      await uploadResumable({
        sessionUri: sessionData.data.sessionUri,
        file: selectedFile,
        chunkSize: sessionData.data.chunkSize,
        signal: controller.signal,
        onProgress: setProgress,
      });

      // 3. Finalize. Server verifies the GCS object actually exists
      //    (defense-in-depth — PR 1) before flipping to READY.
      setPhase("finalizing");
      const completeReqBody: CompleteUploadRequest = { durationMs: null };
      const completeResp = await fetch(
        `/api/video-assets/${sessionData.data.videoAssetId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completeReqBody),
          signal: controller.signal,
        }
      );

      const completeData =
        (await completeResp.json()) as CompleteUploadResponse;
      if (!completeData.ok) {
        throw new Error(completeData.error.message);
      }

      setPhase("done");
      setSelectedFile(null);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";

      router.refresh();
      onCompleted?.();
    } catch (err) {
      console.error("[upload] video upload failed:", err);
      setProgress(null);
      setPhase("idle");
      setError(messageForUploadError(err));
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="video">Video file</FieldLabel>
          <FieldContent>
            <Input
              ref={inputRef}
              id="video"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              disabled={isBusy}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setError(null);
                setPhase("idle");
                setProgress(null);
              }}
            />
            <FieldDescription>
              Supported formats: MP4, MOV, WEBM. Max 2 GB.
            </FieldDescription>
            <FieldError errors={error ? [{ message: error }] : []} />
          </FieldContent>
        </Field>
      </FieldGroup>

      {selectedFile && phase === "idle" ? (
        <p className="text-sm text-muted-foreground">
          Selected: <span className="font-medium">{selectedFile.name}</span> ·{" "}
          {formatBytes(selectedFile.size)}
        </p>
      ) : null}

      {selectedFile && phase !== "idle" ? (
        <UploadProgressCard
          fileName={selectedFile.name}
          totalBytes={selectedFile.size}
          phase={phase}
          progress={progress}
          onCancel={handleCancel}
        />
      ) : null}

      {phase === "done" ? (
        <p className="text-sm text-muted-foreground">Upload complete.</p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!selectedFile || isBusy}
          onClick={handleUpload}
        >
          {isBusy ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

type UploadProgressCardProps = {
  fileName: string;
  totalBytes: number;
  phase: Phase;
  progress: UploadProgress | null;
  onCancel: () => void;
};

function UploadProgressCard({
  fileName,
  totalBytes,
  phase,
  progress,
  onCancel,
}: UploadProgressCardProps) {
  const uploaded = progress?.uploaded ?? 0;
  const percent = progress?.percent ?? 0;
  const bytesPerSec = progress?.bytesPerSec ?? 0;
  const remaining = Math.max(0, totalBytes - uploaded);

  // Map phase to a status line. "uploading" gets a live metric strip;
  // "preparing" / "finalizing" get a quiet one-liner because there's no
  // meaningful percent to show.
  let statusLine: string;
  if (phase === "preparing") {
    statusLine = "Preparing upload…";
  } else if (phase === "finalizing") {
    statusLine = "Finalizing…";
  } else {
    statusLine = `${formatBytes(uploaded)} / ${formatBytes(totalBytes)} · ${formatRate(
      bytesPerSec
    )} · ${formatEta(remaining, bytesPerSec)}`;
  }

  // While preparing/finalizing the progress bar pulses; otherwise it
  // tracks `percent`. Visually anchors the indeterminate phases to the
  // same shape so the UI doesn't restructure mid-upload.
  const isIndeterminate = phase === "preparing" || phase === "finalizing";

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{fileName}</p>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {isIndeterminate ? "—" : `${Math.floor(percent)}%`}
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isIndeterminate ? undefined : Math.floor(percent)}
        aria-label="Upload progress"
      >
        <div
          className={`h-full rounded-full bg-primary transition-[width] ${
            isIndeterminate ? "animate-pulse" : ""
          }`}
          style={{
            width: isIndeterminate ? "100%" : `${Math.min(100, percent)}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {statusLine}
        </p>
        {phase === "uploading" || phase === "preparing" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

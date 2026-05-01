"use client";

import { useRef, useState, useTransition } from "react";
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
  UploadUrlRequest,
  UploadUrlResponse,
} from "@/lib/api/contracts";

type UploadVideoFormProps = {
  rehearsalId: string;
  submitLabel?: string;
  pendingLabel?: string;
  onCompleted?: () => void;
};

export function UploadVideoForm({
  rehearsalId,
  submitLabel = "Upload video",
  pendingLabel = "Uploading...",
  onCompleted,
}: UploadVideoFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleUpload = () => {
    if (!selectedFile) {
      setError("Please choose a video file.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        setStatusMessage("Preparing upload...");

        const uploadUrlRequestBody: UploadUrlRequest = {
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSizeBytes: selectedFile.size,
        };

        const uploadUrlResponse = await fetch(
          `/api/rehearsals/${rehearsalId}/video/upload-url`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(uploadUrlRequestBody),
          }
        );

        const uploadUrlData =
          (await uploadUrlResponse.json()) as UploadUrlResponse;

        if (!uploadUrlData.ok) {
          throw new Error(uploadUrlData.error.message);
        }

        setStatusMessage("Uploading video...");

        const gcsUploadResponse = await fetch(uploadUrlData.data.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": selectedFile.type,
          },
          body: selectedFile,
        });

        if (!gcsUploadResponse.ok) {
          throw new Error("Failed to upload file to storage.");
        }

        setStatusMessage("Finalizing upload...");

        const completeRequestBody: CompleteUploadRequest = {
          durationMs: null,
        };

        const completeResponse = await fetch(
          `/api/video-assets/${uploadUrlData.data.videoAssetId}/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(completeRequestBody),
          }
        );

        const completeData =
          (await completeResponse.json()) as CompleteUploadResponse;

        if (!completeData.ok) {
          throw new Error(completeData.error.message);
        }

        setStatusMessage("Upload complete.");
        setSelectedFile(null);

        if (inputRef.current) {
          inputRef.current.value = "";
        }

        router.refresh();
        onCompleted?.();
      } catch (err) {
        console.error(err);
        setStatusMessage(null);
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      }
    });
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
              disabled={isPending}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setError(null);
                setStatusMessage(null);
              }}
            />
            <FieldDescription>
              Supported formats: MP4, MOV, WEBM.
            </FieldDescription>
            <FieldError errors={error ? [{ message: error }] : []} />
          </FieldContent>
        </Field>
      </FieldGroup>

      {selectedFile ? (
        <div className="text-sm text-muted-foreground">
          Selected: {selectedFile.name} ({selectedFile.size.toLocaleString()}{" "}
          bytes)
        </div>
      ) : null}

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!selectedFile || isPending}
          onClick={handleUpload}
        >
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

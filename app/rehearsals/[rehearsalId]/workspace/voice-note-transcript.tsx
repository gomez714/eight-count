"use client";

import { ChevronDown, ChevronUp, RotateCw } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type {
  TranscriptResponse,
  TranscriptStatus,
} from "@/lib/api/contracts";

const POLL_INTERVAL_MS = 3000;
// 60s ceiling — if Deepgram hasn't returned by then, surface a soft hint
// rather than spinning forever. Matches the worst case for a 2-min audio.
const POLL_CEILING_MS = 60_000;

type VoiceNoteTranscriptProps = {
  audioAssetId: string;
  initialStatus: TranscriptStatus;
  initialTranscript: string | null;
  /** Staff (ADMIN / INSTRUCTOR / ASSISTANT) — gates the retry button. */
  canRetry: boolean;
};

function isTerminal(status: TranscriptStatus): boolean {
  return status === "READY" || status === "FAILED";
}

export function VoiceNoteTranscript({
  audioAssetId,
  initialStatus,
  initialTranscript,
  canRetry,
}: VoiceNoteTranscriptProps) {
  const [status, setStatus] = useState<TranscriptStatus>(initialStatus);
  const [transcript, setTranscript] = useState<string | null>(
    initialTranscript
  );
  const [expanded, setExpanded] = useState(false);
  const [pollExceeded, setPollExceeded] = useState(false);
  const [isRetrying, startRetryTransition] = useTransition();

  const pollStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTerminal(status)) {
      pollStartedAtRef.current = null;
      return;
    }

    if (pollStartedAtRef.current === null) {
      pollStartedAtRef.current = Date.now();
    }

    const controller = new AbortController();

    const tick = async () => {
      // Bail past the ceiling — keep the row's last-known status, just
      // surface a hint to the user.
      if (
        pollStartedAtRef.current !== null &&
        Date.now() - pollStartedAtRef.current > POLL_CEILING_MS
      ) {
        setPollExceeded(true);
        clearInterval(interval);
        return;
      }

      try {
        const response = await fetch(
          `/api/audio-assets/${audioAssetId}/transcript`,
          { signal: controller.signal }
        );
        const data = (await response.json()) as TranscriptResponse;
        if (!data.ok) return;
        setStatus(data.data.status);
        setTranscript(data.data.transcript);
      } catch {
        // Aborted or transient — let the next tick try again.
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [status, audioAssetId]);

  const handleRetry = () => {
    startRetryTransition(async () => {
      try {
        const response = await fetch(
          `/api/audio-assets/${audioAssetId}/transcript/retry`,
          { method: "POST" }
        );
        const data = (await response.json()) as TranscriptResponse;
        if (!data.ok) {
          toast.error(data.error.message ?? "Couldn't retry transcription.");
          return;
        }
        // Optimistic — server already wrote PENDING; polling kicks back in.
        setStatus(data.data.status);
        setTranscript(data.data.transcript);
        setPollExceeded(false);
        pollStartedAtRef.current = null;
        toast.success("Retrying transcription…");
      } catch {
        toast.error("Couldn't retry transcription.");
      }
    });
  };

  // PROCESSING / PENDING — single muted line with animated pulse dot.
  if (status === "PROCESSING" || status === "PENDING") {
    return (
      <div
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
        aria-live="polite"
      >
        <span
          className="inline-flex size-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: "var(--note-voice-accent)" }}
        />
        <span>
          {pollExceeded
            ? "Still working — refresh to check again."
            : "Transcribing voice note…"}
        </span>
      </div>
    );
  }

  // FAILED — soft "unavailable" line, plus a Retry for staff.
  if (status === "FAILED") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span>Transcript unavailable.</span>
        {canRetry ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCw
              aria-hidden
              className={`size-3 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? "Retrying…" : "Try again"}
          </button>
        ) : null}
      </div>
    );
  }

  // READY but empty (silent recording or speech-free audio).
  if (!transcript || transcript.trim().length === 0) {
    return (
      <div className="text-[12px] italic text-muted-foreground">
        No speech detected in this voice note.
      </div>
    );
  }

  // READY with content — collapsible disclosure.
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? (
          <ChevronUp aria-hidden className="size-3.5" />
        ) : (
          <ChevronDown aria-hidden className="size-3.5" />
        )}
        {expanded ? "Hide transcript" : "Show transcript"}
      </button>

      {expanded ? (
        <div
          className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2.5"
          style={{
            borderColor:
              "color-mix(in oklch, var(--note-voice-accent) 18%, transparent)",
          }}
        >
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
            {transcript}
          </p>
          <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Auto-generated transcript
          </p>
        </div>
      ) : null}
    </div>
  );
}

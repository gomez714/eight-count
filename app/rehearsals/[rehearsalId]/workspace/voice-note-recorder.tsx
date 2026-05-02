"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
  AudioCompleteUploadResponse,
  AudioUploadUrlResponse,
  CreateNoteResponse,
  NoteTargetInput,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";

import { formatTimestamp } from "./utils";

const PREVIEW_WAVEFORM_BARS = 32;

// Decorative-only pseudo-waveform; not derived from real audio data.
const PREVIEW_BAR_HEIGHTS = Array.from(
  { length: PREVIEW_WAVEFORM_BARS },
  (_, i) => 35 + Math.abs(Math.sin(i * 0.7)) * 50 + (i % 3) * 5
);

const MAX_RECORDING_MS = 120_000;
const TICK_INTERVAL_MS = 200;
const COUNTDOWN_SECONDS = 3;

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime.startsWith("audio/webm")) return "webm";
  if (mime.startsWith("audio/mp4")) return "mp4";
  if (mime.startsWith("audio/ogg")) return "ogg";
  return "bin";
}

type RecorderState =
  | "idle"
  | "countdown"
  | "recording"
  | "preview"
  | "uploading";

type VoiceNoteRecorderProps = {
  rehearsalId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  buildTargets: () => NoteTargetInput[];
  onSaved: () => void;
  disabled?: boolean;
};

export function VoiceNoteRecorder({
  rehearsalId,
  videoRef,
  buildTargets,
  onSaved,
  disabled = false,
}: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_SECONDS);
  const [previewIsPlaying, setPreviewIsPlaying] = useState(false);
  const [previewCurrentTimeMs, setPreviewCurrentTimeMs] = useState(0);
  const [previewDurationMs, setPreviewDurationMs] = useState<number | null>(
    null
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<number | null>(null);
  const autoStopTimeoutRef = useRef<number | null>(null);
  const countdownTimeoutsRef = useRef<number[]>([]);
  const previousMutedRef = useRef<boolean | null>(null);
  const startTimestampRef = useRef<number>(0);
  const endTimestampRef = useRef<number>(0);
  const blobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef<string | null>(null);

  // Preview-time sync state. Independent from the recording-time mute
  // tracking above so the two flows don't trample each other.
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewSyncingRef = useRef(false);
  const previewPreviousMutedRef = useRef<boolean | null>(null);
  const previewVideoPauseListenerRef = useRef<(() => void) | null>(null);

  const cleanupTimers = () => {
    if (tickIntervalRef.current !== null) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    if (autoStopTimeoutRef.current !== null) {
      window.clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
  };

  const cleanupCountdown = () => {
    for (const id of countdownTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    countdownTimeoutsRef.current = [];
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const restoreVideoMute = () => {
    if (videoRef.current && previousMutedRef.current !== null) {
      videoRef.current.muted = previousMutedRef.current;
      previousMutedRef.current = null;
    }
  };

  const detachPreviewVideoListener = () => {
    const video = videoRef.current;
    const listener = previewVideoPauseListenerRef.current;
    if (video && listener) {
      video.removeEventListener("pause", listener);
    }
    previewVideoPauseListenerRef.current = null;
  };

  const stopPreviewSync = () => {
    if (!previewSyncingRef.current) return;
    const video = videoRef.current;
    if (video) {
      if (!video.paused) video.pause();
      if (previewPreviousMutedRef.current !== null) {
        video.muted = previewPreviousMutedRef.current;
      }
    }
    previewPreviousMutedRef.current = null;
    detachPreviewVideoListener();
    previewSyncingRef.current = false;
  };

  // Tear down the preview transport's React state and the video sync.
  // Called from the handlers that transition out of "preview" (re-record,
  // save) so the cleanup happens at its cause rather than as a reactive
  // effect.
  const resetPreviewState = () => {
    stopPreviewSync();
    setPreviewIsPlaying(false);
    setPreviewCurrentTimeMs(0);
    setPreviewDurationMs(null);
  };

  // Preview audio play: seek the video to where recording started and play
  // them together so the user can confirm the take lines up before saving.
  const handlePreviewAudioPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    previewPreviousMutedRef.current ??= video.muted;
    video.muted = true;
    video.currentTime = startTimestampRef.current / 1000;

    detachPreviewVideoListener();
    const onVideoPause = () => {
      const audio = previewAudioRef.current;
      if (audio && !audio.paused) audio.pause();
    };
    video.addEventListener("pause", onVideoPause);
    previewVideoPauseListenerRef.current = onVideoPause;

    previewSyncingRef.current = true;
    video.play().catch(() => {
      // Autoplay blocks shouldn't break preview audio playback.
    });
  };

  const handlePreviewAudioPauseOrEnd = () => {
    stopPreviewSync();
  };

  // Cleanup on unmount: stop any active recording, release the mic, and
  // clear any pending countdown.
  useEffect(() => {
    return () => {
      cleanupTimers();
      cleanupCountdown();
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      releaseStream();
      restoreVideoMute();
      stopPreviewSync();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    // Resume the video at the captured start timestamp. Recording happens
    // alongside live playback so the saved note is anchored to a watchable
    // moment.
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocks shouldn't fail recording; user can still narrate.
      });
    }

    // eslint-disable-next-line react-hooks/purity -- event handler, not render
    startedAtRef.current = performance.now();
    setElapsedMs(0);

    tickIntervalRef.current = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      const elapsed = performance.now() - startedAtRef.current;
      setElapsedMs(Math.min(elapsed, MAX_RECORDING_MS));
    }, TICK_INTERVAL_MS);

    autoStopTimeoutRef.current = window.setTimeout(() => {
      handleStop();
    }, MAX_RECORDING_MS);

    recorder.start();
    setState("recording");
  };

  const handleStart = async () => {
    if (state !== "idle" || disabled) return;
    setError(null);

    const mime = pickSupportedMimeType();
    if (!mime) {
      setError(
        "Voice recording isn't supported in this browser. Try Chrome, Firefox, or recent Safari."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      const isPermissionDenial =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(
        isPermissionDenial
          ? "Microphone access was denied. Allow it in your browser to record."
          : "Couldn't start the microphone. Check permissions and devices."
      );
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop());
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't start the audio recorder."
      );
      return;
    }

    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    mimeTypeRef.current = mime;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      cleanupTimers();
      releaseStream();
      restoreVideoMute();

      const blob = new Blob(chunksRef.current, { type: mime });
      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setState("preview");
    };
    recorder.onerror = () => {
      cleanupTimers();
      releaseStream();
      restoreVideoMute();
      setError("Recording failed. Please try again.");
      setState("idle");
    };

    // Pause the video and capture the moment the user wants the note to
    // anchor to. The video resumes from this exact point when the
    // countdown ends, so audio + video stay in sync for later playback.
    if (videoRef.current) {
      previousMutedRef.current = videoRef.current.muted;
      videoRef.current.muted = true;
      startTimestampRef.current = Math.floor(
        (videoRef.current.currentTime ?? 0) * 1000
      );
      videoRef.current.pause();
    } else {
      startTimestampRef.current = 0;
    }

    setCountdownValue(COUNTDOWN_SECONDS);
    setState("countdown");

    // Tick down each second; the final tick begins recording.
    for (let i = 1; i <= COUNTDOWN_SECONDS; i++) {
      const isFinal = i === COUNTDOWN_SECONDS;
      const timeoutId = window.setTimeout(() => {
        if (isFinal) {
          beginRecording();
        } else {
          setCountdownValue(COUNTDOWN_SECONDS - i);
        }
      }, i * 1000);
      countdownTimeoutsRef.current.push(timeoutId);
    }
  };

  const handleCancelCountdown = () => {
    if (state !== "countdown") return;
    cleanupCountdown();
    releaseStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    mimeTypeRef.current = null;
    restoreVideoMute();
    setCountdownValue(COUNTDOWN_SECONDS);
    setState("idle");
  };

  const handleStop = () => {
    if (state !== "recording") return;
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (videoRef.current) {
      endTimestampRef.current = Math.floor(
        (videoRef.current.currentTime ?? 0) * 1000
      );
      // Pause the video at the end of the recording so the user can
      // reference where the recording lines up with the video while
      // previewing.
      videoRef.current.pause();
    } else {
      const now = performance.now();
      endTimestampRef.current =
        startTimestampRef.current +
        (startedAtRef.current !== null
          ? Math.floor(now - startedAtRef.current)
          : 0);
    }

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
    // onstop handler transitions to "preview" state.
  };

  const handleRerecord = () => {
    resetPreviewState();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    // Rewind to the original start so the user gets a fresh take from the
    // same anchor point.
    if (videoRef.current) {
      videoRef.current.currentTime = startTimestampRef.current / 1000;
    }
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    mimeTypeRef.current = null;
    setElapsedMs(0);
    setState("idle");
    setError(null);
  };

  const handleSave = async () => {
    if (state !== "preview") return;
    const blob = blobRef.current;
    const mime = mimeTypeRef.current;
    if (!blob || !mime) {
      setError("No recording to save. Try recording again.");
      return;
    }

    resetPreviewState();
    setState("uploading");
    setError(null);

    const startMs = startTimestampRef.current;
    const endMs = Math.max(startMs, endTimestampRef.current);
    const durationMs = Math.max(endMs - startMs, Math.round(elapsedMs));
    const fileName = `voice-note.${extensionForMime(mime)}`;

    try {
      // 1. upload-url
      const uploadUrlResp = await fetch(
        `/api/rehearsals/${rehearsalId}/audio/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            contentType: mime,
            fileSizeBytes: blob.size,
          }),
        }
      );
      const uploadUrlData =
        (await uploadUrlResp.json()) as AudioUploadUrlResponse;
      if (!uploadUrlData.ok) throw new Error(uploadUrlData.error.message);

      // 2. PUT to GCS
      const putResp = await fetch(uploadUrlData.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: blob,
      });
      if (!putResp.ok) throw new Error("Upload to storage failed.");

      // 3. complete
      const completeResp = await fetch(
        `/api/audio-assets/${uploadUrlData.data.audioAssetId}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMs }),
        }
      );
      const completeData =
        (await completeResp.json()) as AudioCompleteUploadResponse;
      if (!completeData.ok) throw new Error(completeData.error.message);

      // 4. create note
      const createResp = await fetch(
        `/api/rehearsals/${rehearsalId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteType: "VOICE",
            audioAssetId: uploadUrlData.data.audioAssetId,
            startTimestampMs: startMs,
            endTimestampMs: endMs,
            targets: buildTargets(),
          }),
        }
      );
      const createData = (await createResp.json()) as CreateNoteResponse;
      if (!createData.ok) throw new Error(createData.error.message);

      // success — clear preview and notify parent
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      blobRef.current = null;
      chunksRef.current = [];
      mimeTypeRef.current = null;
      setElapsedMs(0);
      setState("idle");
      onSaved();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save voice note.";
      setError(message);
      // Stay in preview state with blob retained so the user can retry.
      setState("preview");
    }
  };

  const isCountdown = state === "countdown";
  const isRecording = state === "recording";
  const isPreview = state === "preview";
  const isUploading = state === "uploading";

  return (
    <div className="flex flex-col gap-3">
      {state === "idle" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Click Start to pause the video and prepare a 3-second countdown.
            The video then resumes (muted) while you narrate. Max 2:00.
          </p>
          <Button
            type="button"
            onClick={handleStart}
            disabled={disabled}
            className="w-fit"
          >
            Start recording
          </Button>
        </div>
      ) : null}

      {isCountdown ? (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary text-2xl font-semibold tabular-nums"
              aria-live="assertive"
            >
              {countdownValue}
            </span>
            <span className="text-sm text-muted-foreground">
              Get ready… recording starts in {countdownValue}…
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelCountdown}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      {isRecording ? (
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-3 w-3 animate-pulse rounded-full bg-red-500"
            aria-hidden
          />
          <span className="text-sm font-medium">
            Recording… {formatTimestamp(elapsedMs)} / 2:00
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleStop}
          >
            Stop
          </Button>
        </div>
      ) : null}

      {isPreview && previewUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Preview your recording. The video is paused at the moment you
            stopped — listen to confirm it lines up. Save to attach the note,
            or re-record to replace it.
          </p>
          <PreviewPlayer
            audioRef={previewAudioRef}
            src={previewUrl}
            isPlaying={previewIsPlaying}
            currentTimeMs={previewCurrentTimeMs}
            durationMs={previewDurationMs}
            onPlay={() => {
              setPreviewIsPlaying(true);
              handlePreviewAudioPlay();
            }}
            onPauseOrEnd={() => {
              setPreviewIsPlaying(false);
              handlePreviewAudioPauseOrEnd();
            }}
            onTimeUpdate={setPreviewCurrentTimeMs}
            onLoadedDuration={setPreviewDurationMs}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRerecord}
              disabled={isUploading}
            >
              Re-record
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isUploading || disabled}
            >
              Save voice note
            </Button>
          </div>
        </div>
      ) : null}

      {isUploading ? (
        <p className="text-sm text-muted-foreground">Saving voice note…</p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type PreviewPlayerProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  src: string;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number | null;
  onPlay: () => void;
  onPauseOrEnd: () => void;
  onTimeUpdate: (ms: number) => void;
  onLoadedDuration: (ms: number) => void;
};

function PreviewPlayer({
  audioRef,
  src,
  isPlaying,
  currentTimeMs,
  durationMs,
  onPlay,
  onPauseOrEnd,
  onTimeUpdate,
  onLoadedDuration,
}: PreviewPlayerProps) {
  const effectiveDurationMs = durationMs ?? 0;
  const progressRatio =
    effectiveDurationMs > 0
      ? Math.min(1, currentTimeMs / effectiveDurationMs)
      : 0;
  const filledBars = Math.floor(progressRatio * PREVIEW_WAVEFORM_BARS);

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {
        // Surfaced via the recorder's existing error path.
      });
    } else {
      audio.pause();
    }
  };

  const handleWaveformClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    const audio = audioRef.current;
    if (!audio || effectiveDurationMs <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );
    audio.currentTime = (ratio * effectiveDurationMs) / 1000;
  };

  return (
    <div
      className="flex items-center gap-2.5 rounded-md border px-3 py-2"
      style={{
        backgroundColor: "var(--note-voice-bg)",
        borderColor:
          "color-mix(in oklch, var(--note-voice-accent) 22%, transparent)",
      }}
    >
      <button
        type="button"
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
        onClick={handleTogglePlay}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
        style={{ backgroundColor: "var(--note-voice-accent)" }}
      >
        {isPlaying ? (
          <Pause className="size-3 fill-current" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
      </button>

      <button
        type="button"
        aria-label="Seek within preview"
        onClick={handleWaveformClick}
        className="flex h-5 flex-1 items-center gap-px"
      >
        {PREVIEW_BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${h}%`,
              backgroundColor:
                i < filledBars
                  ? "var(--note-voice-accent)"
                  : "color-mix(in oklch, var(--note-voice-accent) 28%, transparent)",
            }}
          />
        ))}
      </button>

      <span
        className="shrink-0 font-mono text-[11px] tabular-nums"
        style={{
          color:
            "color-mix(in oklch, var(--note-voice-accent) 78%, var(--foreground))",
        }}
      >
        {effectiveDurationMs > 0
          ? `${formatTimestamp(currentTimeMs)} / ${formatTimestamp(effectiveDurationMs)}`
          : "—"}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={onPlay}
        onPause={onPauseOrEnd}
        onEnded={onPauseOrEnd}
        onTimeUpdate={(event) => {
          onTimeUpdate(
            Math.floor((event.currentTarget.currentTime ?? 0) * 1000)
          );
        }}
        onLoadedMetadata={(event) => {
          const seconds = event.currentTarget.duration;
          if (Number.isFinite(seconds) && seconds >= 0) {
            onLoadedDuration(Math.floor(seconds * 1000));
          }
        }}
      />
    </div>
  );
}

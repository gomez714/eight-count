"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { AudioPlaybackResponse } from "@/lib/api/contracts";

import { formatTimestamp } from "./utils";

const WAVEFORM_BARS = 32;

// Decorative-only pseudo-waveform; not derived from real audio data.
const BAR_HEIGHTS = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
  return 35 + Math.abs(Math.sin(i * 0.7)) * 50 + (i % 3) * 5;
});

type VoiceNotePlayerProps = {
  audioAssetId: string;
  durationMs: number | null;
  /**
   * When provided alongside `startTimestampMs`, audio playback is
   * synchronized with this video element: starting the audio seeks the
   * video to `startTimestampMs`, mutes it, and plays both together.
   * Pausing or ending the audio pauses the video and restores its mute
   * state. Pausing the video manually pauses the audio too.
   */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  startTimestampMs?: number;
  /**
   * Fired when this player enters or leaves sync mode. The parent uses
   * this to know when to pin the video into view (e.g. mobile sticky).
   */
  onSyncPlaybackChange?: (audioAssetId: string, isPlaying: boolean) => void;
};

export function VoiceNotePlayer({
  audioAssetId,
  durationMs,
  videoRef,
  startTimestampMs,
  onSyncPlaybackChange,
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [actualDurationMs, setActualDurationMs] = useState<number | null>(null);

  // Sync-mode state: track whether we currently "own" the video so we know
  // when to restore its mute state and detach the pause listener.
  const isSyncingRef = useRef(false);
  const previousMutedRef = useRef<boolean | null>(null);
  const videoPauseListenerRef = useRef<(() => void) | null>(null);

  const effectiveDurationMs = actualDurationMs ?? durationMs ?? 0;
  const progressRatio =
    effectiveDurationMs > 0
      ? Math.min(1, currentTimeMs / effectiveDurationMs)
      : 0;
  const filledBars = Math.floor(progressRatio * WAVEFORM_BARS);

  const detachVideoListener = () => {
    const video = videoRef?.current;
    const listener = videoPauseListenerRef.current;
    if (video && listener) {
      video.removeEventListener("pause", listener);
    }
    videoPauseListenerRef.current = null;
  };

  const stopSync = () => {
    if (!isSyncingRef.current) return;
    const video = videoRef?.current;
    if (video) {
      if (!video.paused) video.pause();
      if (previousMutedRef.current !== null) {
        // eslint-disable-next-line react-hooks/immutability -- restoring video state we own during sync
        video.muted = previousMutedRef.current;
      }
    }
    previousMutedRef.current = null;
    detachVideoListener();
    isSyncingRef.current = false;
    onSyncPlaybackChange?.(audioAssetId, false);
  };

  // Cleanup on unmount: tear down any active sync.
  useEffect(() => {
    return () => {
      stopSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSrc = async (): Promise<string | null> => {
    if (src) return src;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/audio-assets/${audioAssetId}/playback-url`
      );
      const data = (await response.json()) as AudioPlaybackResponse;
      if (!data.ok) throw new Error(data.error.message);
      setSrc(data.data.playbackUrl);
      return data.data.playbackUrl;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load audio.";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePlay = async () => {
    // First click: load the URL, then play once it's mounted.
    if (!src) {
      const url = await ensureSrc();
      if (!url) return;
      requestAnimationFrame(() => {
        audioRef.current?.play().catch(() => {
          setError("Playback failed. Try again.");
        });
      });
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {
        setError("Playback failed. Try again.");
      });
    } else {
      audio.pause();
    }
  };

  const handleWaveformClick = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    // Pre-load: clicking the waveform behaves like the play button.
    if (!src) {
      void handleTogglePlay();
      return;
    }
    const audio = audioRef.current;
    if (!audio || effectiveDurationMs <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );
    audio.currentTime = (ratio * effectiveDurationMs) / 1000;
  };

  // Audio play: in sync mode, seek and play the video alongside.
  const handleAudioPlay = () => {
    setIsPlaying(true);

    const video = videoRef?.current;
    if (!video || startTimestampMs === undefined) return;

    previousMutedRef.current ??= video.muted;
    // eslint-disable-next-line react-hooks/immutability -- driving video state during sync playback
    video.muted = true;
    video.currentTime = startTimestampMs / 1000;

    // Attach a one-shot manual-pause listener so pausing the video pauses
    // the audio too. We detach in stopSync.
    detachVideoListener();
    const onVideoPause = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
    };
    video.addEventListener("pause", onVideoPause);
    videoPauseListenerRef.current = onVideoPause;

    isSyncingRef.current = true;
    onSyncPlaybackChange?.(audioAssetId, true);
    video.play().catch(() => {
      // Autoplay restrictions can fail here; audio still plays alone.
    });
  };

  // Audio pause / end: tear down the sync and restore video state.
  const handleAudioPauseOrEnd = () => {
    setIsPlaying(false);
    stopSync();
  };

  return (
    <div className="flex flex-col gap-1.5">
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
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
          onClick={handleTogglePlay}
          disabled={isLoading}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
          aria-label={src ? "Seek within voice note" : "Play voice note"}
          onClick={handleWaveformClick}
          className="flex h-5 flex-1 items-center gap-px"
        >
          {BAR_HEIGHTS.map((h, i) => (
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
            ? formatTimestamp(effectiveDurationMs)
            : "—"}
        </span>

        {src ? (
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            className="hidden"
            onPlay={handleAudioPlay}
            onPause={handleAudioPauseOrEnd}
            onEnded={handleAudioPauseOrEnd}
            onTimeUpdate={(event) => {
              setCurrentTimeMs(
                Math.floor((event.currentTarget.currentTime ?? 0) * 1000)
              );
            }}
            onLoadedMetadata={(event) => {
              const seconds = event.currentTarget.duration;
              if (Number.isFinite(seconds) && seconds >= 0) {
                setActualDurationMs(Math.floor(seconds * 1000));
              }
            }}
          />
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

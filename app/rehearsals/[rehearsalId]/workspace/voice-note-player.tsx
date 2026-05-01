"use client";

import { useEffect, useRef, useState } from "react";

import type { AudioPlaybackResponse } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";

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
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceNotePlayer({
  audioAssetId,
  durationMs,
  videoRef,
  startTimestampMs,
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync-mode state: track whether we currently "own" the video so we know
  // when to restore its mute state and detach the pause listener.
  const isSyncingRef = useRef(false);
  const previousMutedRef = useRef<boolean | null>(null);
  const videoPauseListenerRef = useRef<(() => void) | null>(null);

  const isSyncMode =
    videoRef !== undefined && startTimestampMs !== undefined;

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

  const handlePlayClick = async () => {
    const url = await ensureSrc();
    if (!url) return;
    requestAnimationFrame(() => {
      audioRef.current?.play().catch(() => {
        setError("Playback failed. Try again.");
      });
    });
  };

  // Audio play: in sync mode, seek and play the video alongside.
  const handleAudioPlay = () => {
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
    video.play().catch(() => {
      // Autoplay restrictions can fail here; audio still plays alone.
    });
  };

  // Audio pause / end: tear down the sync and restore video state.
  const handleAudioPauseOrEnd = () => {
    stopSync();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span aria-hidden>🎙️</span>
        <span>Voice note</span>
        <span>· {formatDuration(durationMs)}</span>
        {isSyncMode ? (
          <span className="text-muted-foreground/70">· plays with video</span>
        ) : null}
      </div>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          controls
          preload="metadata"
          className="w-full"
          onPlay={handleAudioPlay}
          onPause={handleAudioPauseOrEnd}
          onEnded={handleAudioPauseOrEnd}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePlayClick}
          disabled={isLoading}
          className="w-fit"
        >
          {isLoading ? "Loading..." : "Play"}
        </Button>
      )}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

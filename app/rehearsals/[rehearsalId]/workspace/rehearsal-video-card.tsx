"use client"
import { Pause, Play, Rewind, FastForward } from "lucide-react"
import type { RefObject } from "react"
import { useState } from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { formatTimestamp } from "./utils"

type RehearsalVideoCardProps = {
  fileName: string
  playbackUrl: string | null
  isLoading: boolean
  error: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  currentPlaybackMs: number
  videoDurationMs: number
  onDurationChange: (durationMs: number) => void
  onCurrentTimeChange: (currentMs: number) => void
}

export function RehearsalVideoCard({
  fileName,
  playbackUrl,
  isLoading,
  error,
  videoRef,
  currentPlaybackMs,
  videoDurationMs,
  onDurationChange,
  onCurrentTimeChange,
}: RehearsalVideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loading video...</CardTitle>
          <CardDescription>Preparing secure playback.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unable to load video</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!playbackUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            No playback URL available
          </CardTitle>
          <CardDescription>
            This video may still be processing or unavailable.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handlePlayToggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {
        // Autoplay restrictions can fail here; user can retry.
      })
    } else {
      video.pause()
    }
  }

  const handleSeekBy = (deltaMs: number) => {
    const video = videoRef.current
    if (!video) return
    const currentMs = (video.currentTime ?? 0) * 1000
    const nextMs = Math.max(0, currentMs + deltaMs)
    const clamped =
      videoDurationMs > 0 ? Math.min(nextMs, videoDurationMs) : nextMs
    video.currentTime = clamped / 1000
    onCurrentTimeChange(Math.floor(clamped))
  }

  const timeLabel = `${formatTimestamp(currentPlaybackMs)} / ${
    videoDurationMs > 0 ? formatTimestamp(videoDurationMs) : "--:--"
  }`

  return (
    <div
      className="relative rounded-xl p-1.5 shadow-[0_18px_40px_-20px_oklch(0_0_0_/_0.4),0_2px_8px_oklch(0_0_0_/_0.08)]"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.16 0.01 240) 0%, oklch(0.11 0.005 240) 100%)",
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          preload="metadata"
          className="absolute inset-0 size-full object-contain"
          src={playbackUrl}
          onLoadedMetadata={(event) => {
            const durationSeconds = event.currentTarget.duration
            if (Number.isFinite(durationSeconds) && durationSeconds >= 0) {
              onDurationChange(Math.floor(durationSeconds * 1000))
            }
          }}
          onTimeUpdate={(event) => {
            onCurrentTimeChange(
              Math.floor((event.currentTarget.currentTime ?? 0) * 1000)
            )
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={handlePlayToggle}
        >
          Your browser does not support video playback.
        </video>

        {/* Top-left: file watermark */}
        <div className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${
              isPlaying ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
          <span className="truncate max-w-[260px]">{fileName}</span>
        </div>

        {/* Top-right: time pill */}
        <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur-md">
          {timeLabel}
        </div>

        {/* Center play button — only while paused */}
        {!isPlaying ? (
          <button
            type="button"
            aria-label="Play"
            onClick={handlePlayToggle}
            className="absolute top-1/2 left-1/2 inline-flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-neutral-900 shadow-[0_8px_24px_oklch(0_0_0_/_0.5)] transition hover:scale-105"
          >
            <Play className="size-7 fill-current" />
          </button>
        ) : null}
      </div>

      {/* On-plate transport */}
      <div className="mt-3 flex items-center gap-3 px-1 text-white">
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={handlePlayToggle}
          className="inline-flex size-9 items-center justify-center rounded-full bg-white text-neutral-900 hover:bg-white/90"
        >
          {isPlaying ? (
            <Pause className="size-4 fill-current" />
          ) : (
            <Play className="size-4 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSeekBy(-5000)}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-white/85 hover:bg-white/10 hover:text-white"
        >
          <Rewind className="size-3.5" />
          5s
        </button>
        <button
          type="button"
          onClick={() => handleSeekBy(5000)}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-white/85 hover:bg-white/10 hover:text-white"
        >
          <FastForward className="size-3.5" />
          5s
        </button>
        <span className="ml-2 font-mono text-xs font-semibold text-white/95 tabular-nums">
          {formatTimestamp(currentPlaybackMs)}
          <span className="text-white/50">
            {" "}
            /{" "}
            {videoDurationMs > 0 ? formatTimestamp(videoDurationMs) : "--:--"}
          </span>
        </span>
      </div>
    </div>
  )
}

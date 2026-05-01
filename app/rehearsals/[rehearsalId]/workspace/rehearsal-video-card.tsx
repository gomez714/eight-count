"use client"

import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { NoteItem } from "./types"
import { clamp, formatTimestamp } from "./utils"

type RehearsalVideoCardProps = {
  fileName: string
  playbackUrl: string | null
  isLoading: boolean
  error: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  timelineRef: RefObject<HTMLDivElement | null>
  currentPlaybackMs: number
  videoDurationMs: number
  notes: NoteItem[]
  onDurationChange: (durationMs: number) => void
  onCurrentTimeChange: (currentMs: number) => void
  onJumpToTimestamp: (timestampMs: number) => void
  onTimelinePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onTimelinePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onTimelinePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void
}

export function RehearsalVideoCard({
  fileName,
  playbackUrl,
  isLoading,
  error,
  videoRef,
  timelineRef,
  currentPlaybackMs,
  videoDurationMs,
  notes,
  onDurationChange,
  onCurrentTimeChange,
  onJumpToTimestamp,
  onTimelinePointerDown,
  onTimelinePointerMove,
  onTimelinePointerEnd,
}: RehearsalVideoCardProps) {
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

  const currentPlaybackPercent =
    videoDurationMs > 0
      ? clamp((currentPlaybackMs / videoDurationMs) * 100, 0, 100)
      : 0

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{fileName}</CardTitle>
        <CardDescription>Uploaded rehearsal video</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mx-auto w-full">
          <video
            ref={videoRef}
            controls
            preload="metadata"
            className="aspect-video max-h-[55vh] w-full rounded-md border bg-black object-contain"
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
          >
            Your browser does not support video playback.
          </video>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Current time: {formatTimestamp(currentPlaybackMs)}</span>
            <span>
              Duration:{" "}
              {videoDurationMs > 0
                ? formatTimestamp(videoDurationMs)
                : "--:--"}
            </span>
          </div>

          <div
            ref={timelineRef}
            className="relative h-3 w-full cursor-pointer rounded-full bg-muted touch-none select-none"
            onPointerDown={onTimelinePointerDown}
            onPointerMove={onTimelinePointerMove}
            onPointerUp={onTimelinePointerEnd}
            onPointerCancel={onTimelinePointerEnd}
          >
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-primary/25"
              style={{ width: `${currentPlaybackPercent}%` }}
            />

            {notes.map((note) => {
              if (videoDurationMs <= 0) return null

              const left = clamp(
                (note.startTimestampMs / videoDurationMs) * 100,
                0,
                100
              )

              let summary: string
              if (note.noteType === "VOICE") {
                const durationLabel = note.audioAsset?.durationMs
                  ? formatTimestamp(note.audioAsset.durationMs)
                  : "—"
                summary = `Voice note (${durationLabel})`
              } else {
                summary = note.bodyText ?? ""
              }

              return (
                <button
                  key={note.id}
                  type="button"
                  title={`${formatTimestamp(note.startTimestampMs)} — ${summary}`}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow-sm"
                  style={{ left: `${left}%` }}
                  onClick={(event) => {
                    event.stopPropagation()
                    onJumpToTimestamp(note.startTimestampMs)
                  }}
                />
              )
            })}

            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary"
              style={{ left: `${currentPlaybackPercent}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Click the bar to scrub. Click a note marker to jump directly to
            that note.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

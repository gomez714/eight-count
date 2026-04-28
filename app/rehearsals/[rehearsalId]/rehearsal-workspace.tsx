"use client"

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type NoteItem = {
  id: string
  bodyText: string
  timestampMs: number
  createdAt: string | Date
  author: {
    id: string
    name: string | null
    email: string
  }
}

type RehearsalWorkspaceProps = {
  rehearsalId: string
  fileName: string
  notes: NoteItem[]
}

type PlaybackResponse = {
  ok: true
  data: {
    playbackUrl: string
    videoAssetId: string
    mimeType: string
    originalFileName: string
  }
}

type ApiError = {
  ok: false
  error: {
    code: string
    message: string
  }
}

type CreateNoteResponse =
  | {
      ok: true
      data: {
        note: NoteItem
      }
    }
  | ApiError

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function RehearsalWorkspace({
  rehearsalId,
  fileName,
  notes,
}: RehearsalWorkspaceProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const isScrubbingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(true)
  const [videoError, setVideoError] = useState<string | null>(null)

  const [noteText, setNoteText] = useState("")
  const [selectedTimestampMs, setSelectedTimestampMs] = useState(0)
  const [currentPlaybackMs, setCurrentPlaybackMs] = useState(0)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const [noteError, setNoteError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let isMounted = true

    async function loadPlaybackUrl() {
      try {
        setIsLoadingVideo(true)
        setVideoError(null)

        const response = await fetch(
          `/api/rehearsals/${rehearsalId}/video/playback-url`
        )

        const data = (await response.json()) as PlaybackResponse | ApiError

        if (!data.ok) {
          throw new Error(data.error.message)
        }

        if (!response.ok) {
          throw new Error("Failed to load playback URL.")
        }

        if (!isMounted) return

        setPlaybackUrl(data.data.playbackUrl)
      } catch (err) {
        if (!isMounted) return

        setVideoError(
          err instanceof Error ? err.message : "Failed to load video."
        )
      } finally {
        if (isMounted) {
          setIsLoadingVideo(false)
        }
      }
    }

    loadPlaybackUrl()

    return () => {
      isMounted = false
    }
  }, [rehearsalId])

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => a.timestampMs - b.timestampMs),
    [notes]
  )

  const captureCurrentTimestamp = () => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.pause()

    const currentTimeSeconds = videoRef.current.currentTime ?? 0
    const timestampMs = Math.floor(currentTimeSeconds * 1000)

    setSelectedTimestampMs(timestampMs)
    setCurrentPlaybackMs(timestampMs)
    setNoteError(null)
  }

  const jumpToTimestamp = (timestampMs: number) => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.currentTime = timestampMs / 1000
    setCurrentPlaybackMs(timestampMs)
    videoRef.current.focus()
  }

  const handleTimelinePointer = (clientX: number) => {
    if (!timelineRef.current || !videoRef.current || videoDurationMs <= 0) {
      return
    }

    const rect = timelineRef.current.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    const timestampMs = Math.floor(ratio * videoDurationMs)

    videoRef.current.currentTime = timestampMs / 1000
    setCurrentPlaybackMs(timestampMs)
  }

  const handleTimelinePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (videoDurationMs <= 0) return

    isScrubbingRef.current = true
    activePointerIdRef.current = event.pointerId

    event.currentTarget.setPointerCapture(event.pointerId)
    handleTimelinePointer(event.clientX)
  }

  const handleTimelinePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (!isScrubbingRef.current) return
    if (activePointerIdRef.current !== event.pointerId) return

    handleTimelinePointer(event.clientX)
  }

  const handleTimelinePointerEnd = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (activePointerIdRef.current !== event.pointerId) return

    isScrubbingRef.current = false
    activePointerIdRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleCreateNote = () => {
    if (!noteText.trim()) {
      setNoteError("Please enter a note.")
      return
    }

    startTransition(async () => {
      try {
        setNoteError(null)

        const response = await fetch(`/api/rehearsals/${rehearsalId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bodyText: noteText,
            timestampMs: selectedTimestampMs,
          }),
        })

        const data = (await response.json()) as CreateNoteResponse

        if (!data.ok) {
          throw new Error(data.error.message)
        }

        if (!response.ok) {
          throw new Error("Failed to create note.")
        }

        setNoteText("")
        router.refresh()
      } catch (err) {
        setNoteError(
          err instanceof Error ? err.message : "Failed to create note."
        )
      }
    })
  }

  const currentPlaybackPercent =
    videoDurationMs > 0
      ? clamp((currentPlaybackMs / videoDurationMs) * 100, 0, 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="lg:col-span-2 lg:h-full">
          {isLoadingVideo ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loading video...</CardTitle>
                <CardDescription>Preparing secure playback.</CardDescription>
              </CardHeader>
            </Card>
          ) : videoError ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Unable to load video
                </CardTitle>
                <CardDescription>{videoError}</CardDescription>
              </CardHeader>
            </Card>
          ) : playbackUrl ? (
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

                      if (
                        Number.isFinite(durationSeconds) &&
                        durationSeconds >= 0
                      ) {
                        setVideoDurationMs(Math.floor(durationSeconds * 1000))
                      }
                    }}
                    onTimeUpdate={(event) => {
                      setCurrentPlaybackMs(
                        Math.floor(
                          (event.currentTarget.currentTime ?? 0) * 1000
                        )
                      )
                    }}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Current time: {formatTimestamp(currentPlaybackMs)}
                    </span>
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
                    onPointerDown={handleTimelinePointerDown}
                    onPointerMove={handleTimelinePointerMove}
                    onPointerUp={handleTimelinePointerEnd}
                    onPointerCancel={handleTimelinePointerEnd}
                  >
                    <div
                      className="absolute top-0 left-0 h-full rounded-full bg-primary/25"
                      style={{ width: `${currentPlaybackPercent}%` }}
                    />

                    {sortedNotes.map((note) => {
                      if (videoDurationMs <= 0) return null

                      const left = clamp(
                        (note.timestampMs / videoDurationMs) * 100,
                        0,
                        100
                      )

                      return (
                        <button
                          key={note.id}
                          type="button"
                          title={`${formatTimestamp(note.timestampMs)} — ${note.bodyText}`}
                          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow-sm"
                          style={{ left: `${left}%` }}
                          onClick={(event) => {
                            event.stopPropagation()
                            jumpToTimestamp(note.timestampMs)
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
                    Click the bar to scrub. Click a note marker to jump directly
                    to that note.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
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
          )}
        </div>

        <div className="lg:col-span-1 lg:h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Add note</CardTitle>
              <CardDescription>
                Capture the current timestamp, then leave feedback tied to that
                moment.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex h-full flex-col gap-6">
              <FieldGroup className="flex flex-1 flex-col gap-4">
                <Field>
                  <FieldLabel>Selected timestamp</FieldLabel>
                  <FieldContent>
                    <div className="text-sm font-medium">
                      {formatTimestamp(selectedTimestampMs)}
                    </div>
                    <FieldDescription>
                      Capturing a timestamp pauses the video automatically.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                <Field className="flex flex-1 flex-col">
                  <FieldLabel htmlFor="noteText">Note</FieldLabel>
                  <FieldContent className="flex flex-1 flex-col">
                    <Textarea
                      id="noteText"
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Timing is late entering this phrase"
                      disabled={isPending}
                      className="flex-1 resize-none md:min-h-[150px]"
                    />
                    <FieldDescription>
                      Leave a clear correction or reminder for this exact
                      moment.
                    </FieldDescription>
                    <FieldError
                      errors={noteError ? [{ message: noteError }] : []}
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>

              <div className="mt-auto flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={captureCurrentTimestamp}
                  disabled={!playbackUrl || isPending}
                >
                  Capture current timestamp
                </Button>

                <Button
                  type="button"
                  onClick={handleCreateNote}
                  disabled={!playbackUrl || isPending}
                >
                  {isPending ? "Saving..." : "Add note"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Timestamped feedback for this rehearsal video.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notes yet. Add the first one above.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => jumpToTimestamp(note.timestampMs)}
                  className="flex w-full flex-col rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {formatTimestamp(note.timestampMs)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {note.author.name || note.author.email}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {note.bodyText}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
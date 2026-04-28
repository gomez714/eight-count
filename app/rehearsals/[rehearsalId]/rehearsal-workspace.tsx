"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
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
import { Input } from "@/components/ui/input"

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

export function RehearsalWorkspace({
  rehearsalId,
  fileName,
  notes,
}: RehearsalWorkspaceProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(true)
  const [videoError, setVideoError] = useState<string | null>(null)

  const [noteText, setNoteText] = useState("")
  const [selectedTimestampMs, setSelectedTimestampMs] = useState(0)
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
    const currentTimeSeconds = videoRef.current?.currentTime ?? 0
    setSelectedTimestampMs(Math.floor(currentTimeSeconds * 1000))
    setNoteError(null)
  }

  const jumpToTimestamp = (timestampMs: number) => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.currentTime = timestampMs / 1000
    videoRef.current.focus()
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

  return (
    <div className="space-y-6">
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
            <CardTitle className="text-base">Unable to load video</CardTitle>
            <CardDescription>{videoError}</CardDescription>
          </CardHeader>
        </Card>
      ) : playbackUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{fileName}</CardTitle>
            <CardDescription>Uploaded rehearsal video</CardDescription>
          </CardHeader>
          <CardContent>
            <video
              ref={videoRef}
              controls
              preload="metadata"
              className="w-full rounded-md border bg-black"
              src={playbackUrl}
            >
              Your browser does not support video playback.
            </video>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add note</CardTitle>
          <CardDescription>
            Capture the current timestamp, then leave feedback tied to that
            moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <FieldGroup>
            <Field>
              <FieldLabel>Selected timestamp</FieldLabel>
              <FieldContent>
                <div className="text-sm font-medium">
                  {formatTimestamp(selectedTimestampMs)}
                </div>
                <FieldDescription>
                  Use the video player, then capture the current playback time.
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="noteText">Note</FieldLabel>
              <FieldContent>
                <Input
                  id="noteText"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Timing is late entering this phrase"
                  disabled={isPending}
                />
                <FieldError
                  errors={noteError ? [{ message: noteError }] : []}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          <div className="flex flex-wrap gap-3">
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

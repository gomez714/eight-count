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

import type {
  CreateNoteRequest,
  CreateNoteResponse,
  PlaybackResponse,
} from "@/lib/api/contracts"

import { AddNoteCard } from "./add-note-card"
import { NotesListCard } from "./notes-list-card"
import { RehearsalVideoCard } from "./rehearsal-video-card"
import type { AssignableMember, NoteItem } from "./types"
import { clamp } from "./utils"

type RehearsalWorkspaceProps = {
  rehearsalId: string
  fileName: string
  notes: NoteItem[]
  assignableMembers: AssignableMember[]
}

export function RehearsalWorkspace({
  rehearsalId,
  fileName,
  notes,
  assignableMembers,
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
  const [selectedAssigneeUserIds, setSelectedAssigneeUserIds] = useState<
    string[]
  >([])
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

        const data = (await response.json()) as PlaybackResponse

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

  const handleToggleAssignee = (userId: string) => {
    setSelectedAssigneeUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const handleCreateNote = () => {
    if (!noteText.trim()) {
      setNoteError("Please enter a note.")
      return
    }

    startTransition(async () => {
      try {
        setNoteError(null)

        const requestBody: CreateNoteRequest = {
          bodyText: noteText,
          timestampMs: selectedTimestampMs,
          assigneeUserIds: selectedAssigneeUserIds,
        }

        const response = await fetch(`/api/rehearsals/${rehearsalId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        const data = (await response.json()) as CreateNoteResponse

        if (!data.ok) {
          throw new Error(data.error.message)
        }

        if (!response.ok) {
          throw new Error("Failed to create note.")
        }

        setNoteText("")
        setSelectedAssigneeUserIds([])
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
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="lg:col-span-2 lg:h-full">
          <RehearsalVideoCard
            fileName={fileName}
            playbackUrl={playbackUrl}
            isLoading={isLoadingVideo}
            error={videoError}
            videoRef={videoRef}
            timelineRef={timelineRef}
            currentPlaybackMs={currentPlaybackMs}
            videoDurationMs={videoDurationMs}
            notes={sortedNotes}
            onDurationChange={setVideoDurationMs}
            onCurrentTimeChange={setCurrentPlaybackMs}
            onJumpToTimestamp={jumpToTimestamp}
            onTimelinePointerDown={handleTimelinePointerDown}
            onTimelinePointerMove={handleTimelinePointerMove}
            onTimelinePointerEnd={handleTimelinePointerEnd}
          />
        </div>

        <div className="lg:col-span-1 lg:h-full">
          <AddNoteCard
            selectedTimestampMs={selectedTimestampMs}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            selectedAssigneeUserIds={selectedAssigneeUserIds}
            assignableMembers={assignableMembers}
            onToggleAssignee={handleToggleAssignee}
            noteError={noteError}
            isPending={isPending}
            disabled={!playbackUrl || isPending}
            onCapture={captureCurrentTimestamp}
            onSubmit={handleCreateNote}
          />
        </div>
      </div>

      <NotesListCard notes={sortedNotes} onJumpToTimestamp={jumpToTimestamp} />
    </div>
  )
}

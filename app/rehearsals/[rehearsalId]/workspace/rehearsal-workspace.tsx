"use client"

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

import type {
  CreateNoteRequest,
  CreateNoteResponse,
  DeleteNoteResponse,
  NoteTargetInput,
  PlaybackResponse,
  UpdateNoteRequest,
  UpdateNoteResponse,
} from "@/lib/api/contracts"
import {
  EditNoteSheet,
  type EditNoteFormValues,
  type EditableNote,
} from "@/components/edit-note-sheet"

import { AddNoteCard } from "./add-note-card"
import { NotesListCard } from "./notes-list-card"
import { NotesSummary } from "./notes-summary"
import { RehearsalTimelineCard } from "./rehearsal-timeline-card"
import { RehearsalVideoCard } from "./rehearsal-video-card"
import type { AssignableMember, AvailableGroup, NoteItem } from "./types"
import { clamp } from "./utils"

type RehearsalWorkspaceProps = {
  rehearsalId: string
  fileName: string
  notes: NoteItem[]
  assignableMembers: AssignableMember[]
  availableGroups: AvailableGroup[]
  canAuthorNotes: boolean
  currentUserId: string
}

function toEditableNote(note: NoteItem): EditableNote {
  return {
    id: note.id,
    noteType: note.noteType,
    bodyText: note.bodyText,
    startTimestampMs: note.startTimestampMs,
    endTimestampMs: note.endTimestampMs,
    audioAsset: note.audioAsset
      ? {
          id: note.audioAsset.id,
          mimeType: note.audioAsset.mimeType,
          durationMs: note.audioAsset.durationMs,
        }
      : null,
    targets: note.targets.map((target) => ({
      kind: target.kind,
      user: target.user ? { id: target.user.id } : null,
      group: target.group ? { id: target.group.id } : null,
    })),
    assignments: note.assignments.map((assignment) => ({
      userId: assignment.user.id,
      status: assignment.status?.status ?? "OPEN",
      displayName: assignment.user.name || assignment.user.email,
    })),
  }
}

function buildTargetsFromSelection(values: EditNoteFormValues): NoteTargetInput[] {
  if (values.isFullCast) {
    return [{ kind: "EVERYONE" }]
  }
  return [
    ...values.selectedGroupIds.map((projectGroupId) => ({
      kind: "GROUP" as const,
      projectGroupId,
    })),
    ...values.selectedAssigneeUserIds.map((userId) => ({
      kind: "USER" as const,
      userId,
    })),
  ]
}

export function RehearsalWorkspace({
  rehearsalId,
  fileName,
  notes,
  assignableMembers,
  availableGroups,
  canAuthorNotes,
  currentUserId,
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
  const [isFullCast, setIsFullCast] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedAssigneeUserIds, setSelectedAssigneeUserIds] = useState<
    string[]
  >([])
  const [noteError, setNoteError] = useState<string | null>(null)

  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // Tracks which voice notes are currently driving synced video playback.
  // While non-empty, the rehearsal video pins to the top of the viewport on
  // mobile so the user can keep watching while scrolling notes. A Set (not a
  // boolean) handles overlapping playback gracefully — if A is still going
  // when B starts, the video stays pinned until both finish.
  const [syncingAudioIds, setSyncingAudioIds] = useState<Set<string>>(
    () => new Set()
  )
  const isVoiceSyncActive = syncingAudioIds.size > 0

  const handleSyncPlaybackChange = useCallback(
    (audioAssetId: string, isPlaying: boolean) => {
      setSyncingAudioIds((prev) => {
        const next = new Set(prev)
        if (isPlaying) next.add(audioAssetId)
        else next.delete(audioAssetId)
        return next
      })
    },
    []
  )

  const [isPending, startTransition] = useTransition()
  const [isEditPending, startEditTransition] = useTransition()

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
    () => [...notes].sort((a, b) => a.startTimestampMs - b.startTimestampMs),
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

  const handleToggleFullCast = (next: boolean) => {
    setIsFullCast(next)
    if (next) {
      // Full cast subsumes any group/individual selection.
      setSelectedGroupIds([])
      setSelectedAssigneeUserIds([])
    }
  }

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
    // Selecting a group implies we're not in full-cast mode.
    if (isFullCast) setIsFullCast(false)
  }

  const handleCreateNote = () => {
    if (!noteText.trim()) {
      setNoteError("Please enter a note.")
      return
    }

    startTransition(async () => {
      try {
        setNoteError(null)

        let targets: NoteTargetInput[]
        if (isFullCast) {
          targets = [{ kind: "EVERYONE" }]
        } else {
          targets = [
            ...selectedGroupIds.map((projectGroupId) => ({
              kind: "GROUP" as const,
              projectGroupId,
            })),
            ...selectedAssigneeUserIds.map((userId) => ({
              kind: "USER" as const,
              userId,
            })),
          ]
        }

        const requestBody: CreateNoteRequest = {
          noteType: "TEXT",
          bodyText: noteText,
          startTimestampMs: selectedTimestampMs,
          targets,
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
        setSelectedGroupIds([])
        setIsFullCast(false)
        router.refresh()
      } catch (err) {
        setNoteError(
          err instanceof Error ? err.message : "Failed to create note."
        )
      }
    })
  }

  const handleOpenEdit = (note: NoteItem) => {
    setEditError(null)
    setEditingNote(note)
  }

  const handleEditOpenChange = (open: boolean) => {
    if (!open) {
      setEditingNote(null)
      setEditError(null)
    }
  }

  const handleSubmitEdit = (values: EditNoteFormValues) => {
    if (!editingNote) return

    startEditTransition(async () => {
      try {
        setEditError(null)

        const requestBody: UpdateNoteRequest =
          editingNote.noteType === "VOICE"
            ? {
                noteType: "VOICE",
                startTimestampMs: values.startTimestampMs,
                endTimestampMs: values.endTimestampMs ?? values.startTimestampMs,
                targets: buildTargetsFromSelection(values),
              }
            : {
                noteType: "TEXT",
                bodyText: values.bodyText ?? "",
                startTimestampMs: values.startTimestampMs,
                targets: buildTargetsFromSelection(values),
              }

        const response = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data = (await response.json()) as UpdateNoteResponse

        if (!data.ok) {
          throw new Error(data.error.message)
        }

        if (!response.ok) {
          throw new Error("Failed to update note.")
        }

        setEditingNote(null)
        toast.success("Note updated")
        router.refresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update note."
        setEditError(message)
      }
    })
  }

  const handleDeleteNote = async (note: NoteItem) => {
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: "DELETE",
      })

      const data = (await response.json()) as DeleteNoteResponse

      if (!data.ok) {
        throw new Error(data.error.message)
      }

      if (!response.ok) {
        throw new Error("Failed to delete note.")
      }

      toast.success("Note deleted")
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete note."
      toast.error(message)
      throw err
    }
  }

  const getCurrentPlayheadMs = () => {
    const seconds = videoRef.current?.currentTime ?? 0
    return Math.floor(seconds * 1000)
  }

  return (
    <>
      {/*
        Mobile: flex column so the video card's containing block extends through
        the whole page (sticky requires that). lg+: original 2-column grid.
        The left wrapper uses `display: contents` on mobile to flatten its
        children directly into the outer flex column — that's what lets the
        video stick across the entire notes thread, not just within its own
        grid cell.
      */}
      <div className="flex flex-col gap-6 lg:grid lg:gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        {/* LEFT — video + timeline. lg+ pins them together; mobile pins only the video during synced voice playback. */}
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-4 lg:self-start">
          <div
            className={cn(
              isVoiceSyncActive &&
                "max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:shadow-md max-lg:transition-shadow"
            )}
          >
            <RehearsalVideoCard
              fileName={fileName}
              playbackUrl={playbackUrl}
              isLoading={isLoadingVideo}
              error={videoError}
              videoRef={videoRef}
              currentPlaybackMs={currentPlaybackMs}
              videoDurationMs={videoDurationMs}
              onDurationChange={setVideoDurationMs}
              onCurrentTimeChange={setCurrentPlaybackMs}
            />
          </div>
          <RehearsalTimelineCard
            timelineRef={timelineRef}
            currentPlaybackMs={currentPlaybackMs}
            videoDurationMs={videoDurationMs}
            notes={sortedNotes}
            onJumpToTimestamp={jumpToTimestamp}
            onTimelinePointerDown={handleTimelinePointerDown}
            onTimelinePointerMove={handleTimelinePointerMove}
            onTimelinePointerEnd={handleTimelinePointerEnd}
          />
        </div>

        {/* RIGHT — thread column: spine, filter+list card, sticky composer */}
        <div className="flex min-w-0 flex-col gap-4">
          <NotesSummary notes={sortedNotes} />

          <NotesListCard
            notes={sortedNotes}
            assignableMembers={assignableMembers}
            currentUserId={currentUserId}
            videoRef={videoRef}
            onJumpToTimestamp={jumpToTimestamp}
            onEditNote={handleOpenEdit}
            onDeleteNote={handleDeleteNote}
            onSyncPlaybackChange={handleSyncPlaybackChange}
          />

          {canAuthorNotes ? (
            <div className="sticky bottom-4 z-10">
              <AddNoteCard
                rehearsalId={rehearsalId}
                videoRef={videoRef}
                selectedTimestampMs={selectedTimestampMs}
                noteText={noteText}
                onNoteTextChange={setNoteText}
                selectedAssigneeUserIds={selectedAssigneeUserIds}
                assignableMembers={assignableMembers}
                availableGroups={availableGroups}
                selectedGroupIds={selectedGroupIds}
                onToggleAssignee={handleToggleAssignee}
                onToggleGroup={handleToggleGroup}
                isFullCast={isFullCast}
                onToggleFullCast={handleToggleFullCast}
                noteError={noteError}
                isPending={isPending}
                disabled={!playbackUrl || isPending}
                onCapture={captureCurrentTimestamp}
                onSubmit={handleCreateNote}
                onVoiceNoteSaved={() => {
                  setSelectedAssigneeUserIds([])
                  setSelectedGroupIds([])
                  setIsFullCast(false)
                  router.refresh()
                  toast.success("Voice note added")
                }}
              />
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Only admins, instructors, and assistants can author notes.
              You can still review and address notes assigned to you.
            </div>
          )}
        </div>
      </div>

      <EditNoteSheet
        open={editingNote !== null}
        onOpenChange={handleEditOpenChange}
        note={editingNote ? toEditableNote(editingNote) : null}
        assignableMembers={assignableMembers}
        availableGroups={availableGroups}
        onUseCurrentPlayhead={getCurrentPlayheadMs}
        isPending={isEditPending}
        errorMessage={editError}
        onSubmit={handleSubmitEdit}
      />
    </>
  )
}

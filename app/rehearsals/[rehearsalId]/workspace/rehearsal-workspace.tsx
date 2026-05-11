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
import { TipSequence, type TipStep } from "@/components/onboarding/tip-sequence"
import type { NoteTag } from "@/lib/notes/tags"

import { useMediaQuery } from "@/lib/hooks/use-media-query"

import { AddNoteCard } from "./add-note-card"
import type { ComposerMode } from "./composer-body"
import {
  COMPOSER_PEEK_SNAP,
  type ComposerSnap,
  MobileComposerSheet,
} from "./mobile-composer-sheet"
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
  workspaceTipsDismissed: boolean
}

const WORKSPACE_TIP_STEPS: TipStep[] = [
  {
    anchorSelector: "[data-onboarding-anchor='workspace-timeline']",
    title: "Scrub anywhere on the timeline",
    body: "The bars beneath show where notes already exist — taller bars mean more feedback in that moment.",
  },
  {
    anchorSelector: "[data-onboarding-anchor='workspace-composer']",
    title: "Drop a note on the current frame",
    body: "Notes auto-anchor to the current video time — tap the timestamp to update it. Pick an audience, then type or record.",
  },
  {
    anchorSelector: "[data-onboarding-anchor='workspace-notes']",
    title: "Track feedback as you work through it",
    body: "Filter by status, voice notes, or notes you authored. Each note shows who's still working on it.",
  },
]

function toEditableNote(note: NoteItem): EditableNote {
  return {
    id: note.id,
    noteType: note.noteType,
    bodyText: note.bodyText,
    startTimestampMs: note.startTimestampMs,
    endTimestampMs: note.endTimestampMs,
    tag: note.tag,
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
  workspaceTipsDismissed,
}: RehearsalWorkspaceProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const isScrubbingRef = useRef(false)
  const activePointerIdRef = useRef<number | null>(null)
  // Picks which composer shell mounts. Returns null on first render (SSR /
  // pre-hydration); both shells skip rendering until it resolves so we never
  // double-mount VoiceNoteRecorder (which would double-request the mic).
  const isDesktop = useMediaQuery("(min-width: 1024px)")

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
  const [selectedTag, setSelectedTag] = useState<NoteTag | null>(null)
  const [composerMode, setComposerMode] = useState<ComposerMode>("TEXT")
  const [audienceOpen, setAudienceOpen] = useState(false)
  const selectedTagRef = useRef<NoteTag | null>(null)
  useEffect(() => {
    selectedTagRef.current = selectedTag
  }, [selectedTag])
  const getSelectedTag = useCallback(() => selectedTagRef.current, [])
  const [noteError, setNoteError] = useState<string | null>(null)

  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Sticky-video triggers (mobile only) ──────────────────────────────
  // The video pins to the top of the viewport on mobile when any of four
  // signals are active. Set unions to a single `isVideoPinned` boolean
  // applied via the existing `max-lg:sticky` className on the video card.
  //
  // 1. Voice-note sync playback. Tracks which audio assets are currently
  //    driving synced video playback (Set handles overlap gracefully).
  const [syncingAudioIds, setSyncingAudioIds] = useState<Set<string>>(
    () => new Set()
  )
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
  // 2. Video actively playing.
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  // 3. Recent timestamp tap. Pinned for ~10s after a user-initiated jump
  //    so the video stays in view while they read what they just jumped to.
  const tapPinTimeoutRef = useRef<number | null>(null)
  const [timestampTapPinned, setTimestampTapPinned] = useState(false)
  useEffect(() => {
    return () => {
      if (tapPinTimeoutRef.current !== null) {
        window.clearTimeout(tapPinTimeoutRef.current)
      }
    }
  }, [])
  // 4. Composer sheet expanded (mobile only). Derived from the lifted snap
  //    state below — no separate signal needed.

  // Lifted from MobileComposerSheet so #4 above can read it without a
  // callback round-trip. Desktop ignores it (no sheet mounted).
  const [composerSnap, setComposerSnap] =
    useState<ComposerSnap>(COMPOSER_PEEK_SNAP)
  const composerExpanded = composerSnap !== COMPOSER_PEEK_SNAP

  // Voice-recording lock state. True during countdown/recording (not while
  // saving). Used by the sheet to disable mode toggles and bounce snap
  // changes back to EXPANDED_SNAP so accidental swipes can't kill an
  // in-flight take.
  const [isRecording, setIsRecording] = useState(false)

  const isVideoPinned =
    syncingAudioIds.size > 0 ||
    composerExpanded ||
    isVideoPlaying ||
    timestampTapPinned

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

    // Pin the video sticky for ~10s after a user-initiated jump so they can
    // see what they jumped to while continuing to scroll. Re-tapping resets
    // the timer (clear-then-set) instead of accumulating.
    if (tapPinTimeoutRef.current !== null) {
      window.clearTimeout(tapPinTimeoutRef.current)
    }
    setTimestampTapPinned(true)
    tapPinTimeoutRef.current = window.setTimeout(() => {
      setTimestampTapPinned(false)
      tapPinTimeoutRef.current = null
    }, 10_000)
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
          tag: selectedTag,
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
        setSelectedTag(null)
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
                tag: values.tag,
                targets: buildTargetsFromSelection(values),
              }
            : {
                noteType: "TEXT",
                bodyText: values.bodyText ?? "",
                startTimestampMs: values.startTimestampMs,
                tag: values.tag,
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
              isVideoPinned &&
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
              onPlayingChange={setIsVideoPlaying}
            />
          </div>
          <div data-onboarding-anchor="workspace-timeline">
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
        </div>

        {/* RIGHT — thread column: spine, filter+list card, sticky composer.
            On mobile the composer sheet sits ~80px tall at the bottom of the
            viewport over the page content, so add padding-bottom to ensure
            the last notes/items aren't hidden under the peek dock. lg+ uses
            an in-flow sticky composer instead and doesn't need the padding. */}
        <div className="flex min-w-0 flex-col gap-4 max-lg:pb-24">
          <NotesSummary notes={sortedNotes} />

          <div data-onboarding-anchor="workspace-notes">
            <NotesListCard
              notes={sortedNotes}
              assignableMembers={assignableMembers}
              currentUserId={currentUserId}
              canRetryTranscript={canAuthorNotes}
              videoRef={videoRef}
              onJumpToTimestamp={jumpToTimestamp}
              onEditNote={handleOpenEdit}
              onDeleteNote={handleDeleteNote}
              onSyncPlaybackChange={handleSyncPlaybackChange}
            />
          </div>

          {canAuthorNotes ? (
            <>
              {isDesktop === true ? (
                <div
                  data-onboarding-anchor="workspace-composer"
                  className="sticky bottom-4 z-10"
                >
                  <AddNoteCard
                    rehearsalId={rehearsalId}
                    videoRef={videoRef}
                    selectedTimestampMs={selectedTimestampMs}
                    noteText={noteText}
                    onNoteTextChange={setNoteText}
                    mode={composerMode}
                    onModeChange={setComposerMode}
                    audienceOpen={audienceOpen}
                    onAudienceOpenChange={setAudienceOpen}
                    selectedAssigneeUserIds={selectedAssigneeUserIds}
                    assignableMembers={assignableMembers}
                    availableGroups={availableGroups}
                    selectedGroupIds={selectedGroupIds}
                    onToggleAssignee={handleToggleAssignee}
                    onToggleGroup={handleToggleGroup}
                    isFullCast={isFullCast}
                    onToggleFullCast={handleToggleFullCast}
                    selectedTag={selectedTag}
                    onSelectedTagChange={setSelectedTag}
                    getSelectedTag={getSelectedTag}
                    noteError={noteError}
                    isPending={isPending}
                    disabled={!playbackUrl || isPending}
                    onCapture={captureCurrentTimestamp}
                    onSubmit={handleCreateNote}
                    onVoiceNoteSaved={() => {
                      setSelectedAssigneeUserIds([])
                      setSelectedGroupIds([])
                      setIsFullCast(false)
                      setSelectedTag(null)
                      router.refresh()
                      toast.success("Voice note added")
                    }}
                  />
                </div>
              ) : null}
              {isDesktop === false ? (
                <MobileComposerSheet
                  rehearsalId={rehearsalId}
                  videoRef={videoRef}
                  selectedTimestampMs={selectedTimestampMs}
                  noteText={noteText}
                  onNoteTextChange={setNoteText}
                  mode={composerMode}
                  onModeChange={setComposerMode}
                  audienceOpen={audienceOpen}
                  onAudienceOpenChange={setAudienceOpen}
                  selectedAssigneeUserIds={selectedAssigneeUserIds}
                  assignableMembers={assignableMembers}
                  availableGroups={availableGroups}
                  selectedGroupIds={selectedGroupIds}
                  onToggleAssignee={handleToggleAssignee}
                  onToggleGroup={handleToggleGroup}
                  isFullCast={isFullCast}
                  onToggleFullCast={handleToggleFullCast}
                  selectedTag={selectedTag}
                  onSelectedTagChange={setSelectedTag}
                  getSelectedTag={getSelectedTag}
                  noteError={noteError}
                  isPending={isPending}
                  disabled={!playbackUrl || isPending}
                  onCapture={captureCurrentTimestamp}
                  onSubmit={handleCreateNote}
                  onVoiceNoteSaved={() => {
                    setSelectedAssigneeUserIds([])
                    setSelectedGroupIds([])
                    setIsFullCast(false)
                    setSelectedTag(null)
                    router.refresh()
                    toast.success("Voice note added")
                  }}
                  snap={composerSnap}
                  onSnapChange={setComposerSnap}
                  isRecording={isRecording}
                  onRecordingStateChange={setIsRecording}
                />
              ) : null}
            </>
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

      <TipSequence
        groupKey="workspace"
        steps={WORKSPACE_TIP_STEPS}
        initiallyDismissed={workspaceTipsDismissed}
        // Only run for note-authoring roles (the composer step's anchor only
        // exists when canAuthorNotes), and only after the video URL resolves
        // so the timeline anchor isn't pointing at an empty stage. Also
        // hidden while the mobile composer sheet is expanded — the tip's
        // anchor positioning doesn't follow Vaul's transform animation, so
        // hiding the tip until the sheet collapses prevents the orphaned-
        // popover look. State is preserved across the gate (TipSequence
        // returns null when disabled but stays mounted), so the same step
        // resumes when the sheet returns to peek.
        enabled={canAuthorNotes && playbackUrl !== null && !composerExpanded}
        // On every advance (Next / Got it / Skip), collapse the mobile
        // composer sheet back to peek so the next tip's anchor isn't
        // obscured by the expanded sheet (~280px covers the bottom of the
        // notes section). No-op on desktop since the sheet isn't mounted.
        onBeforeAdvance={() => setComposerSnap(COMPOSER_PEEK_SNAP)}
      />
    </>
  )
}

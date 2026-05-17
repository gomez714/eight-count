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
  CreateDiscussionResponse,
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
import { ThreadExpansionProvider } from "@/components/threads/thread-expansion-context"
import { TipSequence, type TipStep } from "@/components/onboarding/tip-sequence"
import type { NoteTag } from "@/lib/notes/tags"

import { useMediaQuery } from "@/lib/hooks/use-media-query"

import { AddDiscussionCard } from "./add-discussion-card"
import { AddNoteCard } from "./add-note-card"
import {
  buildAudienceSummary,
  type ComposerMode,
  computeRecipientCount,
  ComposerBody,
} from "./composer-body"
import { ComposerPeekRow } from "./composer-peek-row"
import { DiscussionComposer } from "./discussion-composer"
import { DiscussionsListCard } from "./discussions-list-card"
import { DiscussionsSummary } from "./discussions-summary"
import {
  COMPOSER_EXPANDED_SNAP,
  COMPOSER_PEEK_SNAP,
  COMPOSER_WRITING_SNAP,
  type ComposerSnap,
  MobileComposerSheet,
} from "./mobile-composer-sheet"
import {
  NotesDiscussionsSwitcher,
  type ListTab,
} from "./notes-discussions-switcher"
import { NotesListCard } from "./notes-list-card"
import { NotesSummary } from "./notes-summary"
import {
  RehearsalTimelineCard,
  type TimelineMarker,
} from "./rehearsal-timeline-card"
import { RehearsalVideoCard } from "./rehearsal-video-card"
import type {
  AssignableMember,
  AvailableGroup,
  DiscussionItem,
  NoteItem,
} from "./types"
import { clamp, formatTimestamp } from "./utils"

type RehearsalWorkspaceProps = {
  rehearsalId: string
  projectId: string
  videoAssetId: string
  fileName: string
  notes: NoteItem[]
  discussions: DiscussionItem[]
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
  projectId,
  videoAssetId,
  fileName,
  notes,
  discussions,
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

  // ── Tab state ────────────────────────────────────────────────────────
  // Single shared `ThreadExpansionProvider` covers both tabs (open
  // threads survive tab toggles; mobile single-open rule applies across
  // the union via `${type}:${id}` keys in the coordinator).
  const [activeListTab, setActiveListTab] = useState<ListTab>("notes")

  // ── Note composer state (existing) ───────────────────────────────────
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

  // ── Discussion composer state (new) ─────────────────────────────────
  // Tab-specific state — separate so drafts survive tab toggles. Mode +
  // snap + recording are intentionally shared with notes (the active
  // composer surface is whichever tab is selected; only one composer
  // exists at a time).
  const [discussionText, setDiscussionText] = useState("")
  const [discussionAnchored, setDiscussionAnchored] = useState(true)
  const [discussionError, setDiscussionError] = useState<string | null>(null)

  const [editingNote, setEditingNote] = useState<NoteItem | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Sticky-video triggers (mobile only) ──────────────────────────────
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const tapPinTimeoutRef = useRef<number | null>(null)
  const [timestampTapPinned, setTimestampTapPinned] = useState(false)
  useEffect(() => {
    return () => {
      if (tapPinTimeoutRef.current !== null) {
        window.clearTimeout(tapPinTimeoutRef.current)
      }
    }
  }, [])

  const [composerSnap, setComposerSnap] =
    useState<ComposerSnap>(COMPOSER_PEEK_SNAP)
  const composerExpanded = composerSnap !== COMPOSER_PEEK_SNAP
  const composerWritingMode = composerSnap === COMPOSER_WRITING_SNAP

  const handleTextareaFocusChange = useCallback(
    (focused: boolean) => {
      if (!focused) return
      if (composerMode !== "TEXT") return
      if (composerSnap === COMPOSER_WRITING_SNAP) return
      setComposerSnap(COMPOSER_WRITING_SNAP)
    },
    [composerMode, composerSnap],
  )

  // Voice-recording lock state. Declared before the handlers that read
  // it so the closure captures the latest value and the useCallback
  // dependency array can include it without an "used before declaration"
  // error.
  const [isRecording, setIsRecording] = useState(false)

  const handleComposerModeChange = useCallback(
    (next: ComposerMode) => {
      // Refuse mode switches mid-recording. The recorder's unmount
      // cleanup releases the mic cleanly, but the in-progress take
      // would be lost — surface a toast so the user understands why
      // the tap didn't take effect. Mobile peek row already guarded
      // this; the desktop sub-bar (notes + discussions) did not, so
      // this is the central gate.
      if (isRecording) {
        toast.message("Stop or save the recording before switching modes.")
        return
      }
      setComposerMode(next)
      setAudienceOpen(false)
      if (next === "VOICE" && composerSnap === COMPOSER_WRITING_SNAP) {
        setComposerSnap(COMPOSER_EXPANDED_SNAP)
      }
    },
    [composerSnap, isRecording],
  )

  const handleAudienceOpenChange = useCallback(
    (open: boolean) => {
      setAudienceOpen(open)
      if (open && composerSnap !== COMPOSER_WRITING_SNAP) {
        setComposerSnap(COMPOSER_WRITING_SNAP)
      }
    },
    [composerSnap],
  )

  // Refuse tab switches mid-recording (the recorder unmount would lose
  // the take). Surface a toast so the user understands why the tap
  // didn't take effect.
  const handleListTabChange = useCallback(
    (next: ListTab) => {
      if (isRecording) {
        toast.message("Stop or save the recording before switching tabs.")
        return
      }
      setActiveListTab(next)
    },
    [isRecording]
  )

  const isVideoPinned =
    syncingAudioIds.size > 0 ||
    composerExpanded ||
    isVideoPlaying ||
    timestampTapPinned

  const [isPending, startTransition] = useTransition()
  const [isEditPending, startEditTransition] = useTransition()
  const [isDiscussionPending, startDiscussionTransition] = useTransition()

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

  // Markers for the timeline. Notes always have a timestamp; discussions
  // are filtered to anchored-only (un-anchored discussions appear in the
  // list but not on the timeline).
  const noteMarkers = useMemo<TimelineMarker[]>(
    () =>
      sortedNotes.map((note) => ({
        id: note.id,
        startTimestampMs: note.startTimestampMs,
        mediaType: note.noteType,
        summary:
          note.noteType === "VOICE"
            ? `Voice note (${note.audioAsset?.durationMs ? formatTimestamp(note.audioAsset.durationMs) : "—"})`
            : (note.bodyText ?? ""),
      })),
    [sortedNotes]
  )
  const discussionMarkers = useMemo<TimelineMarker[]>(
    () =>
      discussions
        .filter((d) => d.startTimestampMs !== null)
        .sort((a, b) => (a.startTimestampMs ?? 0) - (b.startTimestampMs ?? 0))
        .map((d) => ({
          id: d.id,
          startTimestampMs: d.startTimestampMs ?? 0,
          mediaType: d.noteType,
          summary:
            d.noteType === "VOICE"
              ? `Voice discussion (${d.audioAsset?.durationMs ? formatTimestamp(d.audioAsset.durationMs) : "—"})`
              : (d.bodyText ?? ""),
        })),
    [discussions]
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
    setDiscussionError(null)
  }

  const jumpToTimestamp = (timestampMs: number) => {
    if (!videoRef.current) {
      return
    }

    videoRef.current.currentTime = timestampMs / 1000
    setCurrentPlaybackMs(timestampMs)
    videoRef.current.focus()

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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data = (await response.json()) as CreateNoteResponse

        if (!data.ok) {
          throw new Error(data.error.message)
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

  const handleCreateDiscussion = () => {
    if (!discussionText.trim()) {
      setDiscussionError("Please enter a discussion.")
      return
    }

    startDiscussionTransition(async () => {
      try {
        setDiscussionError(null)

        const anchored = discussionAnchored
        const body = {
          noteType: "TEXT" as const,
          bodyText: discussionText,
          rehearsalId,
          ...(anchored
            ? {
                videoAssetId,
                startTimestampMs: selectedTimestampMs,
              }
            : {}),
        }

        const response = await fetch(
          `/api/projects/${projectId}/discussions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        )

        const data = (await response.json()) as CreateDiscussionResponse

        if (!data.ok) {
          throw new Error(data.error.message)
        }

        setDiscussionText("")
        router.refresh()
      } catch (err) {
        setDiscussionError(
          err instanceof Error
            ? err.message
            : "Failed to create discussion."
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

      toast.success("Note deleted")
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete note."
      toast.error(message)
      throw err
    }
  }

  const handleDiscussionDeleted = () => {
    router.refresh()
  }

  const handleVoiceNoteSaved = () => {
    setSelectedAssigneeUserIds([])
    setSelectedGroupIds([])
    setIsFullCast(false)
    setSelectedTag(null)
    setComposerSnap(COMPOSER_PEEK_SNAP)
    router.refresh()
    toast.success("Voice note added")
  }

  const handleVoiceDiscussionSaved = () => {
    setComposerSnap(COMPOSER_PEEK_SNAP)
    router.refresh()
    toast.success("Voice discussion added")
  }

  const getCurrentPlayheadMs = () => {
    const seconds = videoRef.current?.currentTime ?? 0
    return Math.floor(seconds * 1000)
  }

  // Audience summary — only meaningful when the notes tab is active.
  const fullCastCount = assignableMembers.length
  const recipientCount = useMemo(
    () =>
      computeRecipientCount(
        isFullCast,
        fullCastCount,
        availableGroups,
        selectedGroupIds,
        selectedAssigneeUserIds
      ),
    [
      isFullCast,
      fullCastCount,
      availableGroups,
      selectedGroupIds,
      selectedAssigneeUserIds,
    ]
  )
  const audienceSummary = buildAudienceSummary(
    isFullCast,
    fullCastCount,
    selectedGroupIds,
    selectedAssigneeUserIds,
    availableGroups,
    assignableMembers,
    recipientCount
  )

  // Mobile sheet body + peek depend on the active tab. The sheet shell
  // is shared (snap math, recording lock, focus-trap escape, auto-collapse).
  const isNotesTab = activeListTab === "notes"
  const composerDisabled = !playbackUrl || (isNotesTab ? isPending : isDiscussionPending)

  const noteComposerProps = {
    rehearsalId,
    videoRef,
    selectedTimestampMs,
    noteText,
    onNoteTextChange: setNoteText,
    mode: composerMode,
    onModeChange: handleComposerModeChange,
    audienceOpen,
    onAudienceOpenChange: handleAudienceOpenChange,
    selectedAssigneeUserIds,
    assignableMembers,
    availableGroups,
    selectedGroupIds,
    onToggleAssignee: handleToggleAssignee,
    onToggleGroup: handleToggleGroup,
    isFullCast,
    onToggleFullCast: handleToggleFullCast,
    selectedTag,
    onSelectedTagChange: setSelectedTag,
    getSelectedTag,
    noteError,
    isPending,
    disabled: composerDisabled,
    onCapture: captureCurrentTimestamp,
    onSubmit: handleCreateNote,
    onVoiceNoteSaved: handleVoiceNoteSaved,
    writingMode: composerWritingMode,
    onTextareaFocusChange: handleTextareaFocusChange,
    onRecordingStateChange: setIsRecording,
  }

  const discussionComposerProps = {
    rehearsalId,
    projectId,
    videoAssetId,
    videoRef,
    text: discussionText,
    onTextChange: setDiscussionText,
    isAnchored: discussionAnchored,
    onIsAnchoredChange: setDiscussionAnchored,
    selectedTimestampMs,
    onCaptureTimestamp: captureCurrentTimestamp,
    mode: composerMode,
    onModeChange: handleComposerModeChange,
    isPending: isDiscussionPending,
    disabled: composerDisabled,
    onTextSubmit: handleCreateDiscussion,
    onVoiceSaved: handleVoiceDiscussionSaved,
    onRecordingStateChange: setIsRecording,
    writingMode: composerWritingMode,
    onTextareaFocusChange: handleTextareaFocusChange,
    errorMessage: discussionError,
  }

  return (
    <ThreadExpansionProvider>
      <div className="flex flex-col gap-6 lg:grid lg:gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        {/* LEFT — video + timeline */}
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-4 lg:self-start">
          <div
            className={cn(
              composerWritingMode && "max-lg:hidden",
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
          <div
            data-onboarding-anchor="workspace-timeline"
            className={cn(composerWritingMode && "max-lg:hidden")}
          >
            <RehearsalTimelineCard
              timelineRef={timelineRef}
              currentPlaybackMs={currentPlaybackMs}
              videoDurationMs={videoDurationMs}
              markers={isNotesTab ? noteMarkers : discussionMarkers}
              accentTone={isNotesTab ? "notes" : "discussions"}
              countNoun={
                isNotesTab ? ["note", "notes"] : ["discussion", "discussions"]
              }
              onJumpToTimestamp={jumpToTimestamp}
              onTimelinePointerDown={handleTimelinePointerDown}
              onTimelinePointerMove={handleTimelinePointerMove}
              onTimelinePointerEnd={handleTimelinePointerEnd}
            />
          </div>
        </div>

        {/* RIGHT — switcher, summary, list, composer */}
        <div className="flex min-w-0 flex-col gap-4 max-lg:pb-24">
          <NotesDiscussionsSwitcher
            active={activeListTab}
            onChange={handleListTabChange}
            noteCount={notes.length}
            discussionCount={discussions.length}
          />

          {isNotesTab ? (
            <>
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
            </>
          ) : (
            <>
              <DiscussionsSummary discussions={discussions} />
              <DiscussionsListCard
                discussions={discussions}
                currentUserId={currentUserId}
                videoRef={videoRef}
                onJumpToTimestamp={jumpToTimestamp}
                onSyncPlaybackChange={handleSyncPlaybackChange}
                onDiscussionDeleted={handleDiscussionDeleted}
                canRetryTranscript={canAuthorNotes}
              />
            </>
          )}

          {/* Composer — gated on canAuthorNotes for notes; discussions are
              available to any team member. Mounted at lg+ as a sticky card,
              below lg as the shared MobileComposerSheet with body/peek
              built per active tab. */}
          {isNotesTab && !canAuthorNotes ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Only admins, instructors, and assistants can author notes. You
              can still review and address notes assigned to you.
            </div>
          ) : null}

          {(isNotesTab ? canAuthorNotes : true) ? (
            <>
              {isDesktop === true ? (
                <div
                  data-onboarding-anchor="workspace-composer"
                  className="sticky bottom-4 z-10"
                >
                  {isNotesTab ? (
                    <AddNoteCard {...noteComposerProps} />
                  ) : (
                    <AddDiscussionCard {...discussionComposerProps} />
                  )}
                </div>
              ) : null}
              {isDesktop === false ? (
                <MobileComposerSheet
                  snap={composerSnap}
                  onSnapChange={setComposerSnap}
                  isRecording={isRecording}
                  draftText={isNotesTab ? noteText : discussionText}
                  isPending={isNotesTab ? isPending : isDiscussionPending}
                  ariaLabel={
                    isNotesTab ? "Add a note" : "Start a discussion"
                  }
                  ariaDescription={
                    isNotesTab
                      ? "Compose a text or voice note anchored to the current video time."
                      : "Start a text or voice discussion about this rehearsal."
                  }
                  peek={
                    isNotesTab ? (
                      <ComposerPeekRow
                        mode={composerMode}
                        onModeChange={handleComposerModeChange}
                        selectedTimestampMs={selectedTimestampMs}
                        audienceSummary={audienceSummary}
                        onCaptureTimestamp={captureCurrentTimestamp}
                        onTapAudience={() => handleAudienceOpenChange(true)}
                        onExpand={() =>
                          setComposerSnap(COMPOSER_EXPANDED_SNAP)
                        }
                        disabled={composerDisabled}
                      />
                    ) : (
                      <ComposerPeekRow
                        mode={composerMode}
                        onModeChange={handleComposerModeChange}
                        selectedTimestampMs={selectedTimestampMs}
                        audienceSummary={null}
                        onCaptureTimestamp={captureCurrentTimestamp}
                        onExpand={() =>
                          setComposerSnap(COMPOSER_EXPANDED_SNAP)
                        }
                        expandLabelOverride={(mode) =>
                          mode === "VOICE"
                            ? "Tap to record a discussion…"
                            : "Tap to start a discussion…"
                        }
                        disabled={composerDisabled}
                      />
                    )
                  }
                  body={
                    isNotesTab ? (
                      <ComposerBody {...noteComposerProps} />
                    ) : (
                      <DiscussionComposer {...discussionComposerProps} />
                    )
                  }
                />
              ) : null}
            </>
          ) : null}
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
        // Tips key off the notes-mode anchors; skip them entirely while
        // the discussions tab is active (anchors don't exist in that tab).
        enabled={
          canAuthorNotes &&
          playbackUrl !== null &&
          !composerExpanded &&
          isNotesTab
        }
        onBeforeAdvance={() => setComposerSnap(COMPOSER_PEEK_SNAP)}
      />
    </ThreadExpansionProvider>
  )
}

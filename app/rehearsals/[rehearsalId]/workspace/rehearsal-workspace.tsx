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
import { NoVideoBanner } from "./no-video-banner"
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
  /**
   * Null when the rehearsal has no video yet (or one is mid-upload and
   * not READY). In that case the video card + timeline are hidden, the
   * layout collapses to single-column, sticky-video logic is bypassed,
   * and the composer falls back to its no-video mode. Existing un-anchored
   * notes still render via the "Notes without anchor" group.
   */
  videoAssetId: string | null
  fileName: string | null
  notes: NoteItem[]
  discussions: DiscussionItem[]
  assignableMembers: AssignableMember[]
  availableGroups: AvailableGroup[]
  canAuthorNotes: boolean
  /**
   * Staff (ADMIN / INSTRUCTOR / ASSISTANT). Drives whether the no-video
   * banner at the top of the workspace shows the "Upload video" CTA
   * (staff) or the passive "your instructor will upload" copy (dancers).
   */
  canManageVideo: boolean
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
  canManageVideo,
  currentUserId,
  workspaceTipsDismissed,
}: RehearsalWorkspaceProps) {
  const hasVideo = videoAssetId !== null
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

  // Sticky-video pinning only makes sense when there's actually a video.
  // Without one, none of the triggers can fire anyway (no playback, no
  // sync, no tap-to-jump), but short-circuit explicitly for clarity.
  const isVideoPinned =
    hasVideo &&
    (syncingAudioIds.size > 0 ||
      composerExpanded ||
      isVideoPlaying ||
      timestampTapPinned)

  const [isPending, startTransition] = useTransition()
  const [isEditPending, startEditTransition] = useTransition()
  const [isDiscussionPending, startDiscussionTransition] = useTransition()

  useEffect(() => {
    // No video → nothing to fetch. Short-circuit so the workspace doesn't
    // sit in a perpetual "loading video" state when the rehearsal has no
    // VideoAsset (a Phase 1+ scenario).
    if (!hasVideo) {
      setPlaybackUrl(null)
      setIsLoadingVideo(false)
      setVideoError(null)
      return
    }

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
  }, [rehearsalId, hasVideo])

  // Notes can be either anchored (number startTimestampMs) or un-anchored
  // (null — created without a video). The sort puts anchored notes in
  // timeline order at the top; un-anchored notes fall to the bottom in
  // createdAt order. NotesListCard further splits these into two visual
  // groups ("Notes without anchor" above the timeline-anchored list).
  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const aAnchored = a.startTimestampMs !== null
        const bAnchored = b.startTimestampMs !== null
        if (aAnchored && bAnchored) {
          return (a.startTimestampMs ?? 0) - (b.startTimestampMs ?? 0)
        }
        if (aAnchored) return -1
        if (bAnchored) return 1
        // Both un-anchored: newest first.
        const aTime =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime()
        const bTime =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime()
        return bTime - aTime
      }),
    [notes]
  )

  // Markers for the timeline. Un-anchored notes are excluded — same
  // rule that already applied to un-anchored discussions.
  const noteMarkers = useMemo<TimelineMarker[]>(
    () =>
      sortedNotes
        .filter(
          (note): note is NoteItem & { startTimestampMs: number } =>
            note.startTimestampMs !== null
        )
        .map((note) => ({
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

        // No video → omit the timestamp entirely so the note is created
        // un-anchored. The API treats absent startTimestampMs the same as
        // an explicit null and the note shows up in the "Notes without
        // anchor" group on the workspace.
        const requestBody: CreateNoteRequest = {
          noteType: "TEXT",
          bodyText: noteText,
          ...(hasVideo ? { startTimestampMs: selectedTimestampMs } : {}),
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

        // Anchoring requires a video to anchor against. The discussion
        // composer's effectiveAnchored already enforces this in the UI,
        // but defend at the POST boundary too so no-video text discussions
        // can never accidentally send a stray videoAssetId / timestamp.
        const anchored = discussionAnchored && hasVideo
        const body = {
          noteType: "TEXT" as const,
          bodyText: discussionText,
          rehearsalId,
          ...(anchored && videoAssetId
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

        // The form returns `startTimestampMs: null` when the author chose
        // un-anchored (or kept an already-un-anchored note that way). For
        // voice that pairs with a null end. The PATCH route accepts null
        // to clear (un-anchor) or numbers to set — Phase 1 widened the
        // request types accordingly.
        const requestBody: UpdateNoteRequest =
          editingNote.noteType === "VOICE"
            ? {
                noteType: "VOICE",
                startTimestampMs: values.startTimestampMs,
                endTimestampMs:
                  values.startTimestampMs === null
                    ? null
                    : (values.endTimestampMs ?? values.startTimestampMs),
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
  // Only block the composer on playbackUrl when there's actually a video
  // to load. Without one, the discussion composer ships standalone (no
  // anchor) so the pending-fetch state isn't a blocker.
  const composerDisabled =
    (hasVideo && !playbackUrl) ||
    (isNotesTab ? isPending : isDiscussionPending)

  const noteComposerProps = {
    rehearsalId,
    videoRef,
    hasVideo,
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
      <div
        className={cn(
          "flex flex-col gap-6",
          hasVideo &&
            "lg:grid lg:gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start",
          // Without a video the workspace collapses to single column.
          // Constrain max-width so the right column reads as an intentional
          // composition (not a stretched 1.45fr cell with empty space).
          !hasVideo && "lg:mx-auto lg:max-w-3xl",
        )}
      >
        {/* LEFT — video + timeline. Hidden entirely when the rehearsal
            has no video; in that case the workspace renders the right
            column only and the layout becomes single-column. */}
        {hasVideo ? (
        <div className="contents lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-4 lg:self-start">
          <div
            className={cn(
              composerWritingMode && "max-lg:hidden",
              isVideoPinned &&
                "max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:shadow-md max-lg:transition-shadow"
            )}
          >
            <RehearsalVideoCard
              // Non-null assertion is safe here — this entire block is
              // gated on `hasVideo` (`videoAssetId !== null`), and the
              // page entry pairs `fileName` and `videoAssetId` so they
              // are either both null or both set. TypeScript can't
              // refine paired nullables, hence the assertion.
              fileName={fileName!}
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
        ) : null}

        {/* RIGHT — switcher, summary, list, composer */}
        <div className="flex min-w-0 flex-col gap-4 max-lg:pb-24">
          {/* When the rehearsal has no video, surface a prominent banner
              above everything else. Visually fills the space the video
              card would occupy and gives staff a one-click path to
              upload — discoverability fix for the case where the only
              other upload affordance is hidden behind the actions
              menu's overflow icon. */}
          {hasVideo ? null : (
            <NoVideoBanner
              rehearsalId={rehearsalId}
              canManageVideo={canManageVideo}
            />
          )}

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
              built per active tab.

              Both composers work without a video: the sub-bar's timestamp
              pill becomes a "Rehearsal-wide" chip, the recorder falls back
              to its null-videoRef path, and the POSTs omit timestamps +
              videoAssetId so the entities are created un-anchored. The
              top-of-workspace NoVideoBanner (above) handles the no-video
              messaging + upload CTA, so the composer area only needs the
              role gate. */}
          {isNotesTab && !canAuthorNotes ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Only admins, instructors, and assistants can author notes. You
              can still review and address notes assigned to you.
            </div>
          ) : null}

          {/* Mount the composer when:
              - notes tab + viewer can author notes (video-optional), OR
              - discussions tab (always — anyone can author, video optional) */}
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
                        hasVideo={hasVideo}
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
                        hasVideo={hasVideo}
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
        hasVideo={hasVideo}
        onUseCurrentPlayhead={getCurrentPlayheadMs}
        isPending={isEditPending}
        errorMessage={editError}
        onSubmit={handleSubmitEdit}
      />

      <TipSequence
        groupKey="workspace"
        steps={WORKSPACE_TIP_STEPS}
        initiallyDismissed={workspaceTipsDismissed}
        // Tips key off the notes-mode anchors (timeline + composer +
        // notes list). They don't exist when the discussions tab is
        // active, nor when there's no video (the timeline is hidden;
        // the composer is mounted but in its no-video shape with no
        // timestamp pill to point at). Skip the sequence then —
        // showing arrows pointing at nothing is worse than no onboarding.
        enabled={
          canAuthorNotes &&
          hasVideo &&
          playbackUrl !== null &&
          !composerExpanded &&
          isNotesTab
        }
        onBeforeAdvance={() => setComposerSnap(COMPOSER_PEEK_SNAP)}
      />
    </ThreadExpansionProvider>
  )
}

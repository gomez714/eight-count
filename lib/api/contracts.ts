import type { ApiResponse } from "./responses"
import type { NoteTag } from "@/lib/notes/tags"
import type { ReactionKind } from "@/lib/threads/reactions"
import type {
  ThreadComment,
  ThreadReactionSummary,
} from "@/lib/threads/comments"

export type NoteTargetInput =
  | { kind: "EVERYONE" }
  | { kind: "USER"; userId: string }
  | { kind: "GROUP"; projectGroupId: string }

export type CreateTextNoteRequest = {
  noteType?: "TEXT"
  bodyText: string
  /**
   * Optional. When set, the rehearsal must have a ready video; the note
   * is anchored to that moment. When null/omitted, the note is
   * un-anchored and surfaces in the "Notes without anchor" group on the
   * workspace.
   */
  startTimestampMs?: number | null
  tag?: NoteTag | null
  targets?: NoteTargetInput[]
  /**
   * @deprecated Use `targets` instead. Kept for one release for
   * back-compat; server transforms entries into `USER`-kind targets.
   */
  assigneeUserIds?: string[]
}

export type CreateVoiceNoteRequest = {
  noteType: "VOICE"
  audioAssetId: string
  /**
   * Voice timestamps are a coordinated pair. Both must be set (and
   * end >= start) to anchor the recording against video time; both
   * omitted means the audio plays standalone with no anchor (used when
   * the rehearsal has no video yet).
   */
  startTimestampMs?: number | null
  endTimestampMs?: number | null
  tag?: NoteTag | null
  targets?: NoteTargetInput[]
}

export type CreateNoteRequest = CreateTextNoteRequest | CreateVoiceNoteRequest

export type CreateNoteData = {
  note: unknown
}

export type CreateNoteResponse = ApiResponse<CreateNoteData>

export type UploadUrlRequest = {
  fileName: string
  contentType: string
  fileSizeBytes: number
}

export type UploadUrlData = {
  videoAssetId: string
  uploadUrl: string
  objectPath: string
}

export type UploadUrlResponse = ApiResponse<UploadUrlData>

/**
 * Resumable upload session for large video uploads. The server initiates a
 * GCS resumable upload session and returns the session URI; the client then
 * PUTs the file in chunks (size hinted by `chunkSize`) directly to that URI.
 * Sessions are valid for ~7 days (GCS default), so the URL-expiry failure
 * mode that affected the single-PUT `/upload-url` path doesn't apply here.
 * See [lib/upload/resumable-uploader.ts](lib/upload/resumable-uploader.ts).
 */
export type UploadSessionRequest = {
  fileName: string
  contentType: string
  fileSizeBytes: number
}

export type UploadSessionData = {
  videoAssetId: string
  sessionUri: string
  objectPath: string
  chunkSize: number
}

export type UploadSessionResponse = ApiResponse<UploadSessionData>

export type CompleteUploadRequest = {
  durationMs?: number | null
}

export type CompleteUploadData = {
  videoAssetId: string
  status: string
}

export type CompleteUploadResponse = ApiResponse<CompleteUploadData>

export type PlaybackData = {
  playbackUrl: string
  videoAssetId: string
  mimeType: string
  originalFileName: string
}

export type PlaybackResponse = ApiResponse<PlaybackData>

export type AudioUploadUrlRequest = {
  fileName: string
  contentType: string
  fileSizeBytes: number
}

export type AudioUploadUrlData = {
  audioAssetId: string
  uploadUrl: string
  objectPath: string
}

export type AudioUploadUrlResponse = ApiResponse<AudioUploadUrlData>

/**
 * Resumable upload session for audio. Mirrors the video session shape — same
 * pipeline serves voice notes and voice discussions. The `?purpose=discussion`
 * query param applies to this route too (opens authoring to any team member;
 * default is staff-only).
 */
export type AudioUploadSessionRequest = {
  fileName: string
  contentType: string
  fileSizeBytes: number
}

export type AudioUploadSessionData = {
  audioAssetId: string
  sessionUri: string
  objectPath: string
  chunkSize: number
}

export type AudioUploadSessionResponse = ApiResponse<AudioUploadSessionData>

export type AudioCompleteUploadRequest = {
  durationMs?: number | null
}

export type AudioCompleteUploadData = {
  audioAssetId: string
  status: string
}

export type AudioCompleteUploadResponse = ApiResponse<AudioCompleteUploadData>

export type AudioPlaybackData = {
  playbackUrl: string
  audioAssetId: string
  mimeType: string
  durationMs: number | null
}

export type AudioPlaybackResponse = ApiResponse<AudioPlaybackData>

export type TranscriptStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED"

export type TranscriptData = {
  audioAssetId: string
  status: TranscriptStatus
  transcript: string | null
  transcriptError: string | null
}

export type TranscriptResponse = ApiResponse<TranscriptData>

export type UpdateTextNoteRequest = {
  noteType?: "TEXT"
  bodyText: string
  /**
   * PATCH semantics — `undefined` leaves the column untouched, `null`
   * clears it (un-anchors the note), a number sets it (requires the
   * note to already be attached to a video).
   */
  startTimestampMs?: number | null
  tag?: NoteTag | null
  targets: NoteTargetInput[]
}

export type UpdateVoiceNoteRequest = {
  noteType: "VOICE"
  /**
   * Voice timestamps are a coordinated pair on edit too. Valid
   * combinations: both omitted (leave alone), both null (un-anchor),
   * both numbers (re-anchor). Mixed shapes return INVALID_TIMESTAMP_PAIR.
   */
  startTimestampMs?: number | null
  endTimestampMs?: number | null
  tag?: NoteTag | null
  targets: NoteTargetInput[]
}

export type UpdateNoteRequest = UpdateTextNoteRequest | UpdateVoiceNoteRequest

export type UpdateNoteData = {
  note: unknown
}

export type UpdateNoteResponse = ApiResponse<UpdateNoteData>

export type DeleteNoteData = {
  noteId: string
}

export type DeleteNoteResponse = ApiResponse<DeleteNoteData>

export type AudienceMember = {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER"
}

export type AudienceGroup = {
  id: string
  name: string
  memberUserIds: string[]
}

export type AudienceData = {
  assignableMembers: AudienceMember[]
  availableGroups: AudienceGroup[]
}

export type AudienceResponse = ApiResponse<AudienceData>

/**
 * Shared thread response shape. Same payload for note and discussion
 * threads — the client already knows which target it called via the URL,
 * so the response doesn't need to echo an entity id back.
 */
export type ThreadData = {
  comments: ThreadComment[]
  reactions: ThreadReactionSummary[]
  commentCount: number
}

export type ThreadResponse = ApiResponse<ThreadData>

export type CreateCommentRequest = {
  bodyText: string
}

export type CreateCommentResponse = ApiResponse<ThreadData>

export type UpdateCommentRequest = {
  bodyText: string
}

export type UpdateCommentResponse = ApiResponse<ThreadData>

export type DeleteCommentResponse = ApiResponse<ThreadData>

export type ToggleReactionRequest = {
  kind: ReactionKind
}

export type ToggleReactionData = {
  reactions: ThreadReactionSummary[]
}

export type ToggleReactionResponse = ApiResponse<ToggleReactionData>

export type ThreadViewResponse = ApiResponse<{ viewedAt: string }>

// --- Discussion routes ---------------------------------------------------

/**
 * Create a discussion. Discriminated by `noteType` (reuses `NoteType`
 * — see schema comment on `Discussion.noteType`).
 *
 * Validation enforced server-side (not at the schema layer):
 *   - `rehearsalId`, when set, must belong to `projectId`
 *   - `videoAssetId`, when set, must reference the rehearsal's video AND
 *     `rehearsalId` must be set
 *   - timestamps may only be non-null when `videoAssetId` is set
 *   - voice (`noteType: "VOICE"`) requires `rehearsalId` + `audioAssetId`.
 *     `videoAssetId` + timestamps are optional — a voice discussion can be
 *     recorded against a rehearsal that has no video yet (the audio plays
 *     standalone). When `videoAssetId` is set, both timestamps must also
 *     be set. Project-level voice is still unsupported — `AudioAsset.rehearsalId`
 *     is required at the schema level.
 */
export type CreateTextDiscussionRequest = {
  noteType?: "TEXT"
  bodyText: string
  rehearsalId?: string | null
  videoAssetId?: string | null
  startTimestampMs?: number | null
  endTimestampMs?: number | null
}

export type CreateVoiceDiscussionRequest = {
  noteType: "VOICE"
  rehearsalId: string
  audioAssetId: string
  /**
   * Optional video anchor. When set, both timestamps must also be set
   * (and the server validates `videoAssetId` belongs to the rehearsal).
   * When omitted, the voice discussion is un-anchored — the audio plays
   * standalone with no sync.
   */
  videoAssetId?: string | null
  startTimestampMs?: number | null
  endTimestampMs?: number | null
  bodyText?: never
}

export type CreateDiscussionRequest =
  | CreateTextDiscussionRequest
  | CreateVoiceDiscussionRequest

export type CreateDiscussionData = {
  discussion: unknown
}

export type CreateDiscussionResponse = ApiResponse<CreateDiscussionData>

/**
 * Edit a discussion. Author-only. TEXT edits update body + timestamps;
 * VOICE edits update timestamps only (same restriction as Note voice).
 * Tag is deferred to v1.5; not in the request shape yet.
 */
export type UpdateTextDiscussionRequest = {
  noteType?: "TEXT"
  bodyText: string
  startTimestampMs?: number | null
  endTimestampMs?: number | null
}

export type UpdateVoiceDiscussionRequest = {
  noteType: "VOICE"
  /**
   * Voice timestamps are a coordinated pair. Valid combinations:
   * both omitted (leave alone), both null (un-anchor — only valid if
   * the discussion is already video-anchored), or both numbers (set).
   * Mixed shapes return INVALID_TIMESTAMP_PAIR.
   */
  startTimestampMs?: number | null
  endTimestampMs?: number | null
}

export type UpdateDiscussionRequest =
  | UpdateTextDiscussionRequest
  | UpdateVoiceDiscussionRequest

export type UpdateDiscussionData = {
  discussion: unknown
}

export type UpdateDiscussionResponse = ApiResponse<UpdateDiscussionData>

export type DeleteDiscussionData = {
  discussionId: string
}

export type DeleteDiscussionResponse = ApiResponse<DeleteDiscussionData>

// --- Project resources ---------------------------------------------------

/**
 * Create a project-scoped resource (a titled external link in v1; v1.5
 * will add FILE via a separate FileAsset table). Length limits and URL
 * validation are enforced server-side in `lib/resources/validation.ts`:
 * title ≤ 120, URL ≤ 2048 and must be http(s), description ≤ 280.
 *
 * v1 routes through a server action (`createResource` in
 * `app/projects/[projectId]/resource-actions.ts`) rather than an API
 * route. This type sits alongside the others so future API routes
 * share one definition with the validation layer.
 */
export type CreateResourceRequest = {
  title: string
  url: string
  description?: string | null
}

/**
 * Edit a resource. Author-only. Full replace — the edit form always
 * submits all three fields, so there are no PATCH semantics.
 */
export type UpdateResourceRequest = {
  title: string
  url: string
  description?: string | null
}

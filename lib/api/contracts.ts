import type { ApiResponse } from "./responses"
import type { NoteTag } from "@/lib/notes/tags"

export type NoteTargetInput =
  | { kind: "EVERYONE" }
  | { kind: "USER"; userId: string }
  | { kind: "GROUP"; projectGroupId: string }

export type CreateTextNoteRequest = {
  noteType?: "TEXT"
  bodyText: string
  startTimestampMs: number
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
  startTimestampMs: number
  endTimestampMs: number
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
  startTimestampMs: number
  tag?: NoteTag | null
  targets: NoteTargetInput[]
}

export type UpdateVoiceNoteRequest = {
  noteType: "VOICE"
  startTimestampMs: number
  endTimestampMs: number
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

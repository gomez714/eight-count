import type { ApiResponse } from "./responses"

export type NoteTargetInput =
  | { kind: "EVERYONE" }
  | { kind: "USER"; userId: string }
  | { kind: "GROUP"; projectGroupId: string }

export type CreateNoteRequest = {
  bodyText: string
  timestampMs: number
  targets?: NoteTargetInput[]
  /**
   * @deprecated Use `targets` instead. Kept for one release for
   * back-compat; server transforms entries into `USER`-kind targets.
   */
  assigneeUserIds?: string[];
}

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

export type UpdateNoteRequest = {
  bodyText: string
  timestampMs: number
  targets: NoteTargetInput[]
}

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

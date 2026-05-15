import { NextRequest, NextResponse } from "next/server"

import type {
  DeleteCommentResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { COMMENT_MAX_LENGTH } from "@/lib/notes/comments"
import { canViewNoteThread, loadThread } from "@/lib/notes/thread-access"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ noteId: string; commentId: string }> }
): Promise<NextResponse<UpdateCommentResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { noteId, commentId } = await context.params
  const access = await canViewNoteThread(noteId, dbUser.id)
  if (!access) return apiError(404, "NOTE_NOT_FOUND", "Note not found")

  const comment = await db.noteComment.findUnique({
    where: { id: commentId },
    select: { id: true, noteId: true, authorId: true, deletedAt: true },
  })
  if (!comment || comment.noteId !== noteId) {
    return apiError(404, "COMMENT_NOT_FOUND", "Comment not found")
  }
  if (comment.authorId !== dbUser.id) {
    return apiError(403, "FORBIDDEN", "You can only edit your own comments.")
  }
  if (comment.deletedAt !== null) {
    return apiError(
      409,
      "COMMENT_DELETED",
      "Deleted comments cannot be edited."
    )
  }

  let body: UpdateCommentRequest
  try {
    body = (await request.json()) as UpdateCommentRequest
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.")
  }

  const trimmed = (body.bodyText ?? "").trim()
  if (trimmed.length === 0) {
    return apiError(400, "EMPTY_COMMENT", "Comment cannot be empty.")
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return apiError(
      400,
      "COMMENT_TOO_LONG",
      `Comment must be ${COMMENT_MAX_LENGTH} characters or fewer.`
    )
  }

  await db.noteComment.update({
    where: { id: commentId },
    data: { bodyText: trimmed, editedAt: new Date() },
  })

  const thread = await loadThread(noteId, dbUser.id)
  return NextResponse.json<UpdateCommentResponse>({
    ok: true,
    data: { noteId, ...thread },
  })
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ noteId: string; commentId: string }> }
): Promise<NextResponse<DeleteCommentResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { noteId, commentId } = await context.params
  const access = await canViewNoteThread(noteId, dbUser.id)
  if (!access) return apiError(404, "NOTE_NOT_FOUND", "Note not found")

  const comment = await db.noteComment.findUnique({
    where: { id: commentId },
    select: { id: true, noteId: true, authorId: true, deletedAt: true },
  })
  if (!comment || comment.noteId !== noteId) {
    return apiError(404, "COMMENT_NOT_FOUND", "Comment not found")
  }
  if (comment.authorId !== dbUser.id) {
    return apiError(403, "FORBIDDEN", "You can only delete your own comments.")
  }
  if (comment.deletedAt !== null) {
    // Already a tombstone — return current state idempotently.
    const thread = await loadThread(noteId, dbUser.id)
    return NextResponse.json<DeleteCommentResponse>({
      ok: true,
      data: { noteId, ...thread },
    })
  }

  await db.noteComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  const thread = await loadThread(noteId, dbUser.id)
  return NextResponse.json<DeleteCommentResponse>({
    ok: true,
    data: { noteId, ...thread },
  })
}

import { NextRequest, NextResponse } from "next/server"

import type {
  DeleteCommentResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { COMMENT_MAX_LENGTH } from "@/lib/threads/comments"
import { canViewThread, loadThread } from "@/lib/threads/thread-access"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ discussionId: string; commentId: string }> }
): Promise<NextResponse<UpdateCommentResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { discussionId, commentId } = await context.params
  const access = await canViewThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  if (!access)
    return apiError(404, "DISCUSSION_NOT_FOUND", "Discussion not found")

  const comment = await db.discussionComment.findUnique({
    where: { id: commentId },
    select: { id: true, discussionId: true, authorId: true, deletedAt: true },
  })
  if (!comment || comment.discussionId !== discussionId) {
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

  await db.discussionComment.update({
    where: { id: commentId },
    data: { bodyText: trimmed, editedAt: new Date() },
  })

  const thread = await loadThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  return NextResponse.json<UpdateCommentResponse>({ ok: true, data: thread })
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ discussionId: string; commentId: string }> }
): Promise<NextResponse<DeleteCommentResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { discussionId, commentId } = await context.params
  const access = await canViewThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  if (!access)
    return apiError(404, "DISCUSSION_NOT_FOUND", "Discussion not found")

  const comment = await db.discussionComment.findUnique({
    where: { id: commentId },
    select: { id: true, discussionId: true, authorId: true, deletedAt: true },
  })
  if (!comment || comment.discussionId !== discussionId) {
    return apiError(404, "COMMENT_NOT_FOUND", "Comment not found")
  }
  if (comment.authorId !== dbUser.id) {
    return apiError(403, "FORBIDDEN", "You can only delete your own comments.")
  }
  if (comment.deletedAt !== null) {
    // Already a tombstone — return current state idempotently.
    const thread = await loadThread(
      { type: "discussion", id: discussionId },
      dbUser.id
    )
    return NextResponse.json<DeleteCommentResponse>({ ok: true, data: thread })
  }

  await db.discussionComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })

  const thread = await loadThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  return NextResponse.json<DeleteCommentResponse>({ ok: true, data: thread })
}

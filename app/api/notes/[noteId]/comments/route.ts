import { NextRequest, NextResponse } from "next/server"

import type {
  CreateCommentRequest,
  CreateCommentResponse,
  ThreadResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { COMMENT_MAX_LENGTH } from "@/lib/threads/comments"
import { canViewThread, loadThread } from "@/lib/threads/thread-access"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
): Promise<NextResponse<ThreadResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { noteId } = await context.params
  const access = await canViewThread({ type: "note", id: noteId }, dbUser.id)
  if (!access) return apiError(404, "NOTE_NOT_FOUND", "Note not found")

  const thread = await loadThread({ type: "note", id: noteId }, dbUser.id)
  return NextResponse.json<ThreadResponse>({
    ok: true,
    data: { noteId, ...thread },
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
): Promise<NextResponse<CreateCommentResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { noteId } = await context.params
  const access = await canViewThread({ type: "note", id: noteId }, dbUser.id)
  if (!access) return apiError(404, "NOTE_NOT_FOUND", "Note not found")

  let body: CreateCommentRequest
  try {
    body = (await request.json()) as CreateCommentRequest
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

  await db.noteComment.create({
    data: { noteId, authorId: dbUser.id, bodyText: trimmed },
  })

  // Author of the new comment has, by definition, seen the thread up
  // through their own write — bump their view row to prevent the
  // dashboard count from counting comments they just wrote.
  const now = new Date()
  await db.noteThreadView.upsert({
    where: { noteId_userId: { noteId, userId: dbUser.id } },
    create: { noteId, userId: dbUser.id, lastViewedAt: now },
    update: { lastViewedAt: now },
  })

  const thread = await loadThread({ type: "note", id: noteId }, dbUser.id)
  return NextResponse.json<CreateCommentResponse>({
    ok: true,
    data: { noteId, ...thread },
  })
}

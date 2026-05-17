import { NextRequest, NextResponse } from "next/server"

import type {
  ToggleReactionRequest,
  ToggleReactionResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { isReactionKind } from "@/lib/threads/reactions"
import { canViewThread, loadThread } from "@/lib/threads/thread-access"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ discussionId: string }> }
): Promise<NextResponse<ToggleReactionResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { discussionId } = await context.params
  const access = await canViewThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  if (!access)
    return apiError(404, "DISCUSSION_NOT_FOUND", "Discussion not found")

  let body: ToggleReactionRequest
  try {
    body = (await request.json()) as ToggleReactionRequest
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.")
  }

  if (!isReactionKind(body.kind)) {
    return apiError(400, "INVALID_REACTION", "Unknown reaction kind.")
  }

  const existing = await db.discussionReaction.findUnique({
    where: {
      discussionId_userId_kind: {
        discussionId,
        userId: dbUser.id,
        kind: body.kind,
      },
    },
  })

  if (existing) {
    await db.discussionReaction.delete({ where: { id: existing.id } })
  } else {
    await db.discussionReaction.create({
      data: { discussionId, userId: dbUser.id, kind: body.kind },
    })
  }

  const thread = await loadThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  return NextResponse.json<ToggleReactionResponse>({
    ok: true,
    data: { reactions: thread.reactions },
  })
}

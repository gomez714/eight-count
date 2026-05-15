import { NextRequest, NextResponse } from "next/server"

import type {
  ToggleReactionRequest,
  ToggleReactionResponse,
} from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { isReactionKind } from "@/lib/notes/reactions"
import { canViewNoteThread, loadThread } from "@/lib/notes/thread-access"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
): Promise<NextResponse<ToggleReactionResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { noteId } = await context.params
  const access = await canViewNoteThread(noteId, dbUser.id)
  if (!access) return apiError(404, "NOTE_NOT_FOUND", "Note not found")

  let body: ToggleReactionRequest
  try {
    body = (await request.json()) as ToggleReactionRequest
  } catch {
    return apiError(400, "INVALID_BODY", "Invalid JSON body.")
  }

  if (!isReactionKind(body.kind)) {
    return apiError(400, "INVALID_REACTION", "Unknown reaction kind.")
  }

  const existing = await db.noteReaction.findUnique({
    where: {
      noteId_userId_kind: {
        noteId,
        userId: dbUser.id,
        kind: body.kind,
      },
    },
  })

  if (existing) {
    await db.noteReaction.delete({ where: { id: existing.id } })
  } else {
    await db.noteReaction.create({
      data: { noteId, userId: dbUser.id, kind: body.kind },
    })
  }

  const thread = await loadThread(noteId, dbUser.id)
  return NextResponse.json<ToggleReactionResponse>({
    ok: true,
    data: { noteId, reactions: thread.reactions },
  })
}

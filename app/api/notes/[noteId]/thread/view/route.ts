import { NextRequest, NextResponse } from "next/server"

import type { ThreadViewResponse } from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { canViewNoteThread } from "@/lib/notes/thread-access"

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ noteId: string }> }
): Promise<NextResponse<ThreadViewResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { noteId } = await context.params
  const access = await canViewNoteThread(noteId, dbUser.id)
  if (!access) return apiError(404, "NOTE_NOT_FOUND", "Note not found")

  const now = new Date()
  await db.noteThreadView.upsert({
    where: { noteId_userId: { noteId, userId: dbUser.id } },
    create: { noteId, userId: dbUser.id, lastViewedAt: now },
    update: { lastViewedAt: now },
  })

  return NextResponse.json<ThreadViewResponse>({
    ok: true,
    data: { noteId, viewedAt: now.toISOString() },
  })
}

import { NextRequest, NextResponse } from "next/server"

import type { ThreadViewResponse } from "@/lib/api/contracts"
import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"
import { canViewThread } from "@/lib/threads/thread-access"

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ discussionId: string }> }
): Promise<NextResponse<ThreadViewResponse>> {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { discussionId } = await context.params
  const access = await canViewThread(
    { type: "discussion", id: discussionId },
    dbUser.id
  )
  if (!access)
    return apiError(404, "DISCUSSION_NOT_FOUND", "Discussion not found")

  const now = new Date()
  await db.discussionThreadView.upsert({
    where: { discussionId_userId: { discussionId, userId: dbUser.id } },
    create: { discussionId, userId: dbUser.id, lastViewedAt: now },
    update: { lastViewedAt: now },
  })

  return NextResponse.json<ThreadViewResponse>({
    ok: true,
    data: { viewedAt: now.toISOString() },
  })
}

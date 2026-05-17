import { NextRequest, NextResponse } from "next/server"

import { apiError } from "@/lib/api/responses"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { getDiscussionsForRehearsal } from "@/lib/discussions/get-discussions-for-rehearsal"
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user"

/**
 * Workspace-scoped list of discussions anchored to a rehearsal. The
 * project page uses `/api/projects/[projectId]/discussions` instead,
 * which also includes project-level (un-anchored) discussions.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ rehearsalId: string }> }
) {
  const dbUser = await ensureDbUser()
  if (!dbUser) return apiError(401, "UNAUTHORIZED", "Unauthorized")

  const { rehearsalId } = await context.params
  const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id)
  if (!rehearsal) {
    return apiError(
      404,
      "REHEARSAL_NOT_FOUND",
      "Rehearsal not found or access denied"
    )
  }

  const discussions = await getDiscussionsForRehearsal(rehearsalId, dbUser.id)
  return NextResponse.json({ ok: true, data: { discussions } })
}

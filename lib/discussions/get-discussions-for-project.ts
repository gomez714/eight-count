import "server-only"

import { db } from "@/lib/db"

/**
 * List all discussions for a project — both project-level
 * (`rehearsalId IS NULL`) and rehearsal-anchored ones rolled up.
 * Includes the rehearsal title for each rehearsal-anchored row so the
 * project page can render a "Rehearsal: {title}" badge.
 *
 * Caller is responsible for verifying the viewer can access the
 * project (typically via `getProjectForUser`); this helper does not
 * gate on team membership itself.
 *
 * v1 takes a generous safety cap (50). If pagination is ever needed,
 * promote to cursor-based.
 */
const PROJECT_DISCUSSIONS_LIMIT = 50

export async function getDiscussionsForProject(
  projectId: string,
  viewerUserId: string
) {
  return db.discussion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: PROJECT_DISCUSSIONS_LIMIT,
    include: {
      author: true,
      audioAsset: true,
      rehearsal: {
        select: { id: true, title: true },
      },
      comments: {
        select: {
          authorId: true,
          deletedAt: true,
          createdAt: true,
        },
      },
      reactions: {
        select: { kind: true, userId: true },
      },
      threadViews: {
        where: { userId: viewerUserId },
        select: { lastViewedAt: true },
      },
    },
  })
}

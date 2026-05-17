import "server-only"

import { db } from "@/lib/db"

/**
 * List discussions anchored to a specific rehearsal. Includes the
 * `summarizeThread`-shaped slices (comments / reactions / viewer's
 * threadViews) so the page entry can compute the chip seed for each
 * row server-side without a client round-trip — same pattern as
 * `getRehearsalForUser` does for notes.
 *
 * Caller is responsible for verifying the viewer can access the
 * rehearsal (typically via `getRehearsalForUser`); this helper does
 * not gate on team membership itself.
 */
export async function getDiscussionsForRehearsal(
  rehearsalId: string,
  viewerUserId: string
) {
  return db.discussion.findMany({
    where: { rehearsalId },
    orderBy: { createdAt: "desc" },
    include: {
      author: true,
      audioAsset: true,
      comments: {
        // Threads are flat; we only need metadata to derive the chip
        // summary (count, hasUnread). Full bodies fetch on expand via
        // /api/discussions/[id]/comments.
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

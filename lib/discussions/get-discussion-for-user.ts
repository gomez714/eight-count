import "server-only"

import { db } from "@/lib/db"

/**
 * Fetch a single discussion gated on the viewer being a team member of
 * the owning project's team. Used by mutation routes (PATCH/DELETE) to
 * combine ownership + access checks in one Prisma round-trip.
 *
 * Returns `null` when the discussion doesn't exist or the user can't
 * see it. Caller is responsible for the author-only check on PATCH/DELETE
 * (compare `discussion.authorUserId` to the viewer).
 */
export async function getDiscussionForUser(
  discussionId: string,
  userId: string
) {
  return db.discussion.findFirst({
    where: {
      id: discussionId,
      project: {
        team: {
          members: { some: { userId } },
        },
      },
    },
    include: {
      project: {
        include: {
          team: {
            include: {
              members: { where: { userId } },
            },
          },
        },
      },
      rehearsal: true,
      videoAsset: true,
      audioAsset: true,
      author: true,
    },
  })
}

import "server-only"

import { db } from "@/lib/db"

/**
 * Fetch a single resource gated on the viewer being a team member of
 * the owning project's team. Used by mutation actions (update / delete)
 * to combine ownership + access checks in one Prisma round-trip.
 *
 * Returns `null` when the resource doesn't exist or the user can't see
 * it. Caller is responsible for the author-only check on mutations
 * (compare `resource.createdByUserId` to the viewer id).
 *
 * Mirrors the `getDiscussionForUser` shape — same access-chain walk
 * (resource → project → team → members), one less hop than the note
 * helpers since resources don't require a rehearsal.
 */
export async function getResourceForUser(
  resourceId: string,
  userId: string
) {
  return db.projectResource.findFirst({
    where: {
      id: resourceId,
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
    },
  })
}

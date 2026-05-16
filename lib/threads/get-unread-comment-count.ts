import { db } from "@/lib/db"

/**
 * Count of comments the viewer hasn't yet seen across notes they're
 * involved with (author OR assignee). Excludes the viewer's own
 * comments and soft-deleted ones. Powers the dashboard tile chip.
 *
 * Implementation: one Prisma query — find candidate comments by
 * note relationship and view-timestamp filter. Reasonable performance
 * for v1; if the scan ever grows hot we can promote to a materialized
 * `unreadCount` integer on `NoteThreadView`.
 */
export async function getUnreadCommentCountForUser(
  userId: string
): Promise<number> {
  const noteIds = await db.note.findMany({
    where: {
      OR: [{ authorUserId: userId }, { assignments: { some: { userId } } }],
    },
    select: { id: true },
  })
  if (noteIds.length === 0) return 0
  const ids = noteIds.map((n) => n.id)

  const views = await db.noteThreadView.findMany({
    where: { userId, noteId: { in: ids } },
    select: { noteId: true, lastViewedAt: true },
  })
  const lastViewedByNoteId = new Map(
    views.map((v) => [v.noteId, v.lastViewedAt] as const)
  )

  const comments = await db.noteComment.findMany({
    where: {
      noteId: { in: ids },
      deletedAt: null,
      authorId: { not: userId },
    },
    select: { noteId: true, createdAt: true },
  })

  let count = 0
  for (const c of comments) {
    const lastViewed = lastViewedByNoteId.get(c.noteId)
    if (lastViewed === undefined || c.createdAt > lastViewed) {
      count += 1
    }
  }
  return count
}

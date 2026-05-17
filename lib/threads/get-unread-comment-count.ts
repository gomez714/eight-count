import { db } from "@/lib/db"

/**
 * Combined count of unread thread comments the viewer hasn't yet seen,
 * across BOTH note threads and discussion threads. Powers the dashboard
 * tile chip + meta-band "New replies" line.
 *
 * The two threads use different scoping rules — see each helper below —
 * but the surfaced count is intentionally combined per the Decisions log:
 * users think in terms of "new replies waiting", not "new replies on
 * notes vs. discussions". If it ever feels right to split them, the
 * dashboard surfaces can fan out by calling the inner helpers directly.
 *
 * Implementation: two parallel batches of small Prisma queries.
 * Reasonable performance for v1; if either scan grows hot we can
 * promote to materialized counts on the respective `ThreadView` tables.
 */
export async function getUnreadCommentCountForUser(
  userId: string
): Promise<number> {
  const [noteUnread, discussionUnread] = await Promise.all([
    countUnreadNoteComments(userId),
    countUnreadDiscussionComments(userId),
  ])
  return noteUnread + discussionUnread
}

/**
 * Note thread unreads. **Engagement-scoped**: comments on notes where
 * the user is the author OR an assignee. Excludes the user's own
 * comments and soft-deleted ones; counts those newer than the user's
 * `NoteThreadView.lastViewedAt` (or all of them if no view row exists).
 */
async function countUnreadNoteComments(userId: string): Promise<number> {
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

/**
 * Discussion thread unreads. **Membership-scoped**: comments on
 * discussions in projects on any team the user belongs to. Discussions
 * have no author-or-assignee narrowing (they're inherently team-wide),
 * so the natural scope is "anywhere I can see". Same exclusion rules
 * as notes: not the user's own comments, not soft-deleted ones, newer
 * than the user's `DiscussionThreadView.lastViewedAt`.
 */
async function countUnreadDiscussionComments(
  userId: string
): Promise<number> {
  const discussionIds = await db.discussion.findMany({
    where: {
      project: {
        team: {
          members: { some: { userId } },
        },
      },
    },
    select: { id: true },
  })
  if (discussionIds.length === 0) return 0
  const ids = discussionIds.map((d) => d.id)

  const views = await db.discussionThreadView.findMany({
    where: { userId, discussionId: { in: ids } },
    select: { discussionId: true, lastViewedAt: true },
  })
  const lastViewedByDiscussionId = new Map(
    views.map((v) => [v.discussionId, v.lastViewedAt] as const)
  )

  const comments = await db.discussionComment.findMany({
    where: {
      discussionId: { in: ids },
      deletedAt: null,
      authorId: { not: userId },
    },
    select: { discussionId: true, createdAt: true },
  })

  let count = 0
  for (const c of comments) {
    const lastViewed = lastViewedByDiscussionId.get(c.discussionId)
    if (lastViewed === undefined || c.createdAt > lastViewed) {
      count += 1
    }
  }
  return count
}

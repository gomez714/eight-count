import { REACTION_KINDS, type ReactionKind } from "./reactions"

/**
 * Client-safe module: constants, types, and pure helpers for note threads.
 * Server-only helpers that touch Prisma (`canViewNoteThread`, `loadThread`)
 * live in `./thread-access.ts` — importing those from a client component
 * pulls the Postgres client into the browser bundle.
 */

export const COMMENT_MAX_LENGTH = 2000

export type ThreadComment = {
  id: string
  authorId: string
  authorName: string | null
  authorEmail: string
  authorImageUrl: string | null
  authorRole: "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER" | null
  bodyText: string | null
  editedAt: string | null
  deleted: boolean
  createdAt: string
}

export type ThreadReactionSummary = {
  kind: ReactionKind
  count: number
  viewerReacted: boolean
}

export type ThreadPayload = {
  comments: ThreadComment[]
  reactions: ThreadReactionSummary[]
  commentCount: number
}

export type ThreadSummary = {
  commentCount: number
  reactions: ThreadReactionSummary[]
  hasUnread: boolean
}

/**
 * Pure helper: given a note's raw comment + reaction rows (already
 * fetched server-side) and the viewer's last-view timestamp, produce
 * the seed values for `NoteThreadAttachment`. Used by every surface
 * that renders a thread chip so the initial paint is correct without
 * a client round-trip.
 */
export function summarizeThread(input: {
  viewerId: string
  comments: Array<{
    authorId: string
    deletedAt: Date | null
    createdAt: Date
  }>
  reactions: Array<{ kind: ReactionKind; userId: string }>
  lastViewedAt: Date | null
}): ThreadSummary {
  const commentCount = input.comments.filter(
    (c) => c.deletedAt === null
  ).length

  const reactionMap = new Map<ReactionKind, ThreadReactionSummary>()
  for (const kind of REACTION_KINDS) {
    reactionMap.set(kind, { kind, count: 0, viewerReacted: false })
  }
  for (const r of input.reactions) {
    const summary = reactionMap.get(r.kind)
    if (!summary) continue
    summary.count += 1
    if (r.userId === input.viewerId) summary.viewerReacted = true
  }
  // Drop zero-count, non-viewer kinds so the chip stays tidy.
  const reactions = Array.from(reactionMap.values()).filter(
    (r) => r.count > 0 || r.viewerReacted
  )

  const hasUnread = input.comments.some(
    (c) =>
      c.deletedAt === null &&
      c.authorId !== input.viewerId &&
      (input.lastViewedAt === null || c.createdAt > input.lastViewedAt)
  )

  return { commentCount, reactions, hasUnread }
}

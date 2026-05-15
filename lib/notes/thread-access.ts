import "server-only"

import { db } from "@/lib/db"

import type {
  ThreadComment,
  ThreadPayload,
  ThreadReactionSummary,
} from "./comments"
import type { ReactionKind } from "./reactions"

/**
 * Server-only thread helpers (Prisma access). Kept separate from
 * `./comments.ts` so client components can import the client-safe
 * constants/types/`summarizeThread` without pulling the Postgres
 * client into the browser bundle.
 */

/**
 * Verify that a user can see a note's thread. Mirrors note visibility:
 * any active team member of the owning team can read and post.
 */
export async function canViewNoteThread(
  noteId: string,
  userId: string
): Promise<{ noteId: string; teamId: string } | null> {
  const row = await db.note.findFirst({
    where: {
      id: noteId,
      rehearsal: {
        project: {
          team: {
            members: { some: { userId } },
          },
        },
      },
    },
    select: {
      id: true,
      rehearsal: { select: { project: { select: { teamId: true } } } },
    },
  })
  if (!row) return null
  return { noteId: row.id, teamId: row.rehearsal.project.teamId }
}

/**
 * Serialize the thread for a viewer: comments (with soft-delete tombstones
 * preserving authorship + timestamp), aggregated reaction counts with the
 * viewer's own reaction state, and a non-deleted comment count.
 */
export async function loadThread(
  noteId: string,
  viewerId: string
): Promise<ThreadPayload> {
  const [comments, reactions, teamRoleByUser] = await Promise.all([
    db.noteComment.findMany({
      where: { noteId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
    }),
    db.noteReaction.findMany({
      where: { noteId },
      select: { kind: true, userId: true },
    }),
    loadCommentAuthorRoles(noteId),
  ])

  const reactionMap = new Map<ReactionKind, ThreadReactionSummary>()
  for (const r of reactions) {
    const existing = reactionMap.get(r.kind) ?? {
      kind: r.kind,
      count: 0,
      viewerReacted: false,
    }
    existing.count += 1
    if (r.userId === viewerId) existing.viewerReacted = true
    reactionMap.set(r.kind, existing)
  }

  const serializedComments: ThreadComment[] = comments.map((c) => {
    const deleted = c.deletedAt !== null
    return {
      id: c.id,
      authorId: c.author.id,
      authorName: c.author.name,
      authorEmail: c.author.email,
      authorImageUrl: c.author.imageUrl,
      authorRole: teamRoleByUser.get(c.author.id) ?? null,
      bodyText: deleted ? null : c.bodyText,
      editedAt: c.editedAt ? c.editedAt.toISOString() : null,
      deleted,
      createdAt: c.createdAt.toISOString(),
    }
  })

  return {
    comments: serializedComments,
    reactions: Array.from(reactionMap.values()),
    commentCount: comments.filter((c) => c.deletedAt === null).length,
  }
}

/**
 * Resolve each comment author's role within the note's team so the
 * comment row can render a role pill. Authors who have since left
 * the team return `null` (their comment still renders, no pill).
 */
async function loadCommentAuthorRoles(
  noteId: string
): Promise<Map<string, "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER">> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: {
      rehearsal: { select: { project: { select: { teamId: true } } } },
    },
  })
  if (!note) return new Map()

  const members = await db.teamMember.findMany({
    where: { teamId: note.rehearsal.project.teamId },
    select: { userId: true, role: true },
  })
  return new Map(members.map((m) => [m.userId, m.role]))
}

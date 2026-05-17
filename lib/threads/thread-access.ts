import "server-only"

import type { TeamRole } from "@/generated/prisma/client"
import { db } from "@/lib/db"

import type { ThreadTarget } from "./api-paths"
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
 *
 * Parameterized over `ThreadTarget` so the same access + serialization
 * shape covers both notes and discussions. Discussion branches throw
 * `THREAD_TARGET_NOT_IMPLEMENTED` until the discussion schema lands.
 */

/**
 * Verify that a user can see a thread. For notes, walks
 * note → rehearsal → project → team → members. For discussions, walks
 * discussion → project → team → members (one less hop — discussions
 * don't require a rehearsal). Either branch returns null when the user
 * is not a team member of the owning team.
 */
export async function canViewThread(
  target: ThreadTarget,
  userId: string
): Promise<{ target: ThreadTarget; teamId: string } | null> {
  if (target.type === "note") {
    const row = await db.note.findFirst({
      where: {
        id: target.id,
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
    return { target, teamId: row.rehearsal.project.teamId }
  }
  const row = await db.discussion.findFirst({
    where: {
      id: target.id,
      project: {
        team: {
          members: { some: { userId } },
        },
      },
    },
    select: {
      id: true,
      project: { select: { teamId: true } },
    },
  })
  if (!row) return null
  return { target, teamId: row.project.teamId }
}

/**
 * Serialize a thread for a viewer: comments (with soft-delete tombstones
 * preserving authorship + timestamp), aggregated reaction counts with the
 * viewer's own reaction state, and a non-deleted comment count.
 */
export async function loadThread(
  target: ThreadTarget,
  viewerId: string
): Promise<ThreadPayload> {
  if (target.type === "note") {
    return loadNoteThread(target.id, viewerId)
  }
  return loadDiscussionThread(target.id, viewerId)
}

async function loadNoteThread(
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
    loadNoteCommentAuthorRoles(noteId),
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
async function loadNoteCommentAuthorRoles(
  noteId: string
): Promise<Map<string, TeamRole>> {
  const note = await db.note.findUnique({
    where: { id: noteId },
    select: {
      rehearsal: { select: { project: { select: { teamId: true } } } },
    },
  })
  if (!note) return new Map()

  return loadTeamRoleMap(note.rehearsal.project.teamId)
}

async function loadDiscussionThread(
  discussionId: string,
  viewerId: string
): Promise<ThreadPayload> {
  const [comments, reactions, teamRoleByUser] = await Promise.all([
    db.discussionComment.findMany({
      where: { discussionId },
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
    db.discussionReaction.findMany({
      where: { discussionId },
      select: { kind: true, userId: true },
    }),
    loadDiscussionCommentAuthorRoles(discussionId),
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

async function loadDiscussionCommentAuthorRoles(
  discussionId: string
): Promise<Map<string, TeamRole>> {
  const discussion = await db.discussion.findUnique({
    where: { id: discussionId },
    select: { project: { select: { teamId: true } } },
  })
  if (!discussion) return new Map()

  return loadTeamRoleMap(discussion.project.teamId)
}

async function loadTeamRoleMap(
  teamId: string
): Promise<Map<string, TeamRole>> {
  const members = await db.teamMember.findMany({
    where: { teamId },
    select: { userId: true, role: true },
  })
  return new Map(members.map((m) => [m.userId, m.role]))
}

import "server-only";

import { pickAvatarTone } from "@/components/avatar-initials";
import { db } from "@/lib/db";

import type {
  ActivityActor,
  ActivityFetchOptions,
  ActivityItem,
  ActivityPage,
  ActivityScope,
  DiscussionStartedActivity,
  NoteAddedActivity,
  StatusChangeActivity,
  ThreadReplyActivity,
} from "./types";

/**
 * Activity feed read API. Single public surface — components consume the
 * returned `ActivityPage` without knowing whether the data was derived on
 * the fly (today) or read from a materialized `Activity` table (someday).
 *
 * For v1, this runs five parallel queries scoped to the viewer's teams
 * and time-bounded to `windowDays` (default 30). Each query returns at
 * most `limit + 1` rows so we can detect `hasMore` after the merge.
 *
 * Empty result handling: a viewer with zero memberships short-circuits
 * to an empty page (no queries fired). Quiet-week detection lives in
 * `quiet-week.ts` — the caller compares the page's items against
 * `QUIET_WINDOW_DAYS` to decide which UI state to render.
 */

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_DAYS = 30;
const BODY_EXCERPT_LIMIT = 140;

export async function getActivityForUser(
  viewerId: string,
  options: ActivityFetchOptions = {}
): Promise<ActivityPage> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const includeSelf = options.includeSelf ?? false;
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;

  const now = new Date();
  const cursor = options.cursor ? new Date(options.cursor) : now;
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Bail before firing five queries when the viewer has no teams.
  const memberships = await db.teamMember.findMany({
    where: { userId: viewerId },
    select: { teamId: true },
  });
  if (memberships.length === 0) {
    return { items: [], hasMore: false, nextCursor: null };
  }
  const teamIds = memberships.map((m) => m.teamId);

  // Fetch `limit + 1` per source so we can detect overflow after the merge.
  const sliceCap = limit + 1;
  const queryArgs = { viewerId, teamIds, since, cursor, includeSelf, take: sliceCap };

  const [notes, noteReplies, statusChanges, discussions, discussionReplies] =
    await Promise.all([
      queryNotesAdded(queryArgs),
      queryNoteReplies(queryArgs),
      queryStatusChanges(queryArgs),
      queryDiscussionsStarted(queryArgs),
      queryDiscussionReplies(queryArgs),
    ]);

  const merged: ActivityItem[] = [
    ...notes,
    ...noteReplies,
    ...statusChanges,
    ...discussions,
    ...discussionReplies,
  ];
  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const items = merged.slice(0, limit);
  const hasMore = merged.length > limit;
  const nextCursor =
    items.length > 0
      ? items[items.length - 1].createdAt.toISOString()
      : null;

  return { items, hasMore, nextCursor };
}

/* ------------------------------ helpers ------------------------------ */

function truncateBody(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= BODY_EXCERPT_LIMIT) return trimmed;
  return `${trimmed.slice(0, BODY_EXCERPT_LIMIT - 1).trimEnd()}…`;
}

function toActor(user: { id: string; name: string | null }): ActivityActor {
  return {
    id: user.id,
    name: user.name,
    tone: pickAvatarTone(user.id),
  };
}

/**
 * Resolves the audience label for a note from its targets + assignments.
 * Returns `{ isForViewer, audienceLabel }`. When `isForViewer` is true,
 * `audienceLabel` may still be non-null when the viewer is one of several
 * recipients (e.g. "for the cast · 14") — the UI can decide whether to
 * combine "You" pill + audience or just show "You".
 */
function resolveAudience(
  targets: ReadonlyArray<{
    kind: "EVERYONE" | "GROUP" | "USER";
    userId: string | null;
    user: { id: string; name: string | null } | null;
    group: { id: string; name: string } | null;
  }>,
  assignments: ReadonlyArray<{ userId: string }>,
  viewerId: string
): { isForViewer: boolean; audienceLabel: string | null } {
  const assignmentCount = assignments.length;
  const isForViewer = assignments.some((a) => a.userId === viewerId);

  // Audience label heuristic: prefer the first non-USER target's identity
  // since group/everyone carries semantic meaning. Single-user targets get
  // the user's name. Mixed audiences fall back to "the cast".
  let label: string | null = null;
  if (targets.length === 0) {
    label = null;
  } else if (targets.some((t) => t.kind === "EVERYONE")) {
    label = assignmentCount > 1 ? `the cast · ${assignmentCount}` : "the cast";
  } else {
    const group = targets.find((t) => t.kind === "GROUP" && t.group);
    if (group?.group) {
      label =
        assignmentCount > 1
          ? `${group.group.name} · ${assignmentCount}`
          : group.group.name;
    } else {
      const userTargets = targets.filter((t) => t.kind === "USER" && t.user);
      if (userTargets.length === 1 && userTargets[0].user) {
        label = userTargets[0].user.name ?? "the cast";
      } else if (userTargets.length > 1) {
        label = `the cast · ${assignmentCount}`;
      }
    }
  }

  return { isForViewer, audienceLabel: label };
}

/* ------------------------------ queries ------------------------------ */

type QueryArgs = {
  viewerId: string;
  teamIds: string[];
  since: Date;
  cursor: Date;
  includeSelf: boolean;
  take: number;
};

async function queryNotesAdded(args: QueryArgs): Promise<NoteAddedActivity[]> {
  const rows = await db.note.findMany({
    where: {
      rehearsal: { project: { teamId: { in: args.teamIds } } },
      ...(args.includeSelf ? {} : { authorUserId: { not: args.viewerId } }),
      createdAt: { gte: args.since, lt: args.cursor },
    },
    select: {
      id: true,
      noteType: true,
      bodyText: true,
      startTimestampMs: true,
      tag: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      rehearsal: {
        select: {
          id: true,
          title: true,
          project: {
            select: {
              id: true,
              title: true,
              team: { select: { id: true, name: true } },
            },
          },
        },
      },
      targets: {
        select: {
          kind: true,
          userId: true,
          user: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      },
      assignments: { select: { userId: true } },
      audioAsset: {
        select: {
          id: true,
          durationMs: true,
          transcript: true,
          transcriptStatus: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: args.take,
  });

  return rows.map((row): NoteAddedActivity => {
    const scope: ActivityScope = {
      teamId: row.rehearsal.project.team.id,
      teamName: row.rehearsal.project.team.name,
      projectId: row.rehearsal.project.id,
      projectTitle: row.rehearsal.project.title,
      rehearsalId: row.rehearsal.id,
      rehearsalTitle: row.rehearsal.title,
    };
    const { isForViewer, audienceLabel } = resolveAudience(
      row.targets,
      row.assignments,
      args.viewerId
    );
    return {
      kind: "note-added",
      id: `note-added:${row.id}`,
      createdAt: row.createdAt,
      actor: toActor(row.author),
      scope,
      noteId: row.id,
      noteType: row.noteType,
      bodyExcerpt: row.noteType === "TEXT" ? truncateBody(row.bodyText) : null,
      tag: row.tag,
      startTimestampMs: row.startTimestampMs,
      isForViewer,
      audienceLabel,
      voice: row.audioAsset
        ? {
            audioAssetId: row.audioAsset.id,
            durationMs: row.audioAsset.durationMs,
            transcriptStatus: row.audioAsset.transcriptStatus,
            transcript: row.audioAsset.transcript,
          }
        : null,
    };
  });
}

async function queryNoteReplies(
  args: QueryArgs
): Promise<ThreadReplyActivity[]> {
  // Engagement-scoped: comments on notes where viewer is author or assignee.
  const rows = await db.noteComment.findMany({
    where: {
      note: {
        OR: [
          { authorUserId: args.viewerId },
          { assignments: { some: { userId: args.viewerId } } },
        ],
      },
      ...(args.includeSelf ? {} : { authorId: { not: args.viewerId } }),
      deletedAt: null,
      createdAt: { gte: args.since, lt: args.cursor },
    },
    select: {
      id: true,
      bodyText: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      note: {
        select: {
          id: true,
          bodyText: true,
          startTimestampMs: true,
          rehearsal: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  title: true,
                  team: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: args.take,
  });

  return rows.map((row): ThreadReplyActivity => {
    const scope: ActivityScope = {
      teamId: row.note.rehearsal.project.team.id,
      teamName: row.note.rehearsal.project.team.name,
      projectId: row.note.rehearsal.project.id,
      projectTitle: row.note.rehearsal.project.title,
      rehearsalId: row.note.rehearsal.id,
      rehearsalTitle: row.note.rehearsal.title,
    };
    return {
      kind: "thread-reply",
      id: `thread-reply-note:${row.id}`,
      createdAt: row.createdAt,
      actor: toActor(row.author),
      scope,
      commentId: row.id,
      bodyExcerpt: truncateBody(row.bodyText) ?? "",
      parent: {
        type: "note",
        noteId: row.note.id,
        parentBodyExcerpt: truncateBody(row.note.bodyText),
        parentStartTimestampMs: row.note.startTimestampMs,
      },
    };
  });
}

async function queryStatusChanges(
  args: QueryArgs
): Promise<StatusChangeActivity[]> {
  // Author-scoped: status changes on notes the viewer wrote, by other users.
  const rows = await db.noteAssignmentStatus.findMany({
    where: {
      noteAssignment: {
        note: { authorUserId: args.viewerId },
      },
      ...(args.includeSelf
        ? {}
        : { updatedByUserId: { not: args.viewerId } }),
      updatedAt: { gte: args.since, lt: args.cursor },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      updatedBy: { select: { id: true, name: true } },
      noteAssignment: {
        select: {
          note: {
            select: {
              id: true,
              bodyText: true,
              startTimestampMs: true,
              tag: true,
              rehearsal: {
                select: {
                  id: true,
                  title: true,
                  project: {
                    select: {
                      id: true,
                      title: true,
                      team: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: args.take,
  });

  return rows.flatMap((row): StatusChangeActivity[] => {
    // `updatedBy` is nullable (legacy rows). Skip rows we can't attribute
    // since the feed needs a named actor to render the prefix.
    if (!row.updatedBy) return [];
    const note = row.noteAssignment.note;
    const scope: ActivityScope = {
      teamId: note.rehearsal.project.team.id,
      teamName: note.rehearsal.project.team.name,
      projectId: note.rehearsal.project.id,
      projectTitle: note.rehearsal.project.title,
      rehearsalId: note.rehearsal.id,
      rehearsalTitle: note.rehearsal.title,
    };
    return [
      {
        kind: "status-change",
        id: `status-change:${row.id}`,
        createdAt: row.updatedAt,
        actor: toActor(row.updatedBy),
        scope,
        noteId: note.id,
        status: row.status,
        noteBodyExcerpt: truncateBody(note.bodyText),
        noteStartTimestampMs: note.startTimestampMs,
        noteTag: note.tag,
      },
    ];
  });
}

async function queryDiscussionsStarted(
  args: QueryArgs
): Promise<DiscussionStartedActivity[]> {
  const rows = await db.discussion.findMany({
    where: {
      project: { teamId: { in: args.teamIds } },
      ...(args.includeSelf ? {} : { authorUserId: { not: args.viewerId } }),
      createdAt: { gte: args.since, lt: args.cursor },
    },
    select: {
      id: true,
      noteType: true,
      bodyText: true,
      startTimestampMs: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      project: {
        select: {
          id: true,
          title: true,
          team: { select: { id: true, name: true } },
        },
      },
      rehearsal: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: args.take,
  });

  return rows.map((row): DiscussionStartedActivity => {
    const scope: ActivityScope = {
      teamId: row.project.team.id,
      teamName: row.project.team.name,
      projectId: row.project.id,
      projectTitle: row.project.title,
      rehearsalId: row.rehearsal?.id ?? null,
      rehearsalTitle: row.rehearsal?.title ?? null,
    };
    return {
      kind: "discussion-started",
      id: `discussion-started:${row.id}`,
      createdAt: row.createdAt,
      actor: toActor(row.author),
      scope,
      discussionId: row.id,
      noteType: row.noteType,
      bodyExcerpt:
        row.noteType === "TEXT" ? truncateBody(row.bodyText) : null,
      startTimestampMs: row.startTimestampMs,
    };
  });
}

async function queryDiscussionReplies(
  args: QueryArgs
): Promise<ThreadReplyActivity[]> {
  // Membership-scoped: any discussion in viewer's teams (matches the
  // unread-comment helper's discussion-side scoping).
  const rows = await db.discussionComment.findMany({
    where: {
      discussion: {
        project: { teamId: { in: args.teamIds } },
      },
      ...(args.includeSelf ? {} : { authorId: { not: args.viewerId } }),
      deletedAt: null,
      createdAt: { gte: args.since, lt: args.cursor },
    },
    select: {
      id: true,
      bodyText: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      discussion: {
        select: {
          id: true,
          bodyText: true,
          startTimestampMs: true,
          project: {
            select: {
              id: true,
              title: true,
              team: { select: { id: true, name: true } },
            },
          },
          rehearsal: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: args.take,
  });

  return rows.map((row): ThreadReplyActivity => {
    const scope: ActivityScope = {
      teamId: row.discussion.project.team.id,
      teamName: row.discussion.project.team.name,
      projectId: row.discussion.project.id,
      projectTitle: row.discussion.project.title,
      rehearsalId: row.discussion.rehearsal?.id ?? null,
      rehearsalTitle: row.discussion.rehearsal?.title ?? null,
    };
    return {
      kind: "thread-reply",
      id: `thread-reply-discussion:${row.id}`,
      createdAt: row.createdAt,
      actor: toActor(row.author),
      scope,
      commentId: row.id,
      bodyExcerpt: truncateBody(row.bodyText) ?? "",
      parent: {
        type: "discussion",
        discussionId: row.discussion.id,
        parentBodyExcerpt: truncateBody(row.discussion.bodyText),
        parentStartTimestampMs: row.discussion.startTimestampMs,
      },
    };
  });
}

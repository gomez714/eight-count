import { db } from "@/lib/db";
import { isNoteStalled, STALLED_THRESHOLD_DAYS } from "@/lib/notes/stalled";
import type { NoteStatus } from "@/lib/notes/statuses";

/**
 * Maximum activity window when a user has never received a digest before
 * (or hasn't received one in over a week). Caps the "What's new" section
 * so the first email doesn't list weeks of backlog.
 */
const MAX_LOOKBACK_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PREVIEW_BODY_LENGTH = 140;
const MAX_INLINE_ITEMS = 3;

export type DigestNoteItem = {
  noteId: string;
  rehearsalId: string;
  projectTitle: string;
  rehearsalTitle: string;
  authorName: string;
  bodyPreview: string;
  isVoice: boolean;
};

export type DigestThreadItem = {
  threadType: "note" | "discussion";
  /** Note id or discussion id — used to deep-link into the source surface. */
  entityId: string;
  rehearsalId: string | null;
  projectTitle: string;
  /** Short label like "Iris's note" or "discussion about the bridge". */
  threadLabel: string;
  newCommentCount: number;
};

export type DigestStalledItem = {
  noteId: string;
  rehearsalId: string;
  projectTitle: string;
  rehearsalTitle: string;
  bodyPreview: string;
  isVoice: boolean;
  /** Number of recipients still OPEN or IN_PROGRESS. */
  activeRecipientCount: number;
  /** Days since the note was authored, rounded down. */
  ageInDays: number;
};

export type DigestPayload = {
  userId: string;
  /** Recipient-side: new note assignments since `since`. */
  newAssignments: DigestNoteItem[];
  newAssignmentsTotal: number;
  /** Anyone: new thread comments on notes/discussions the viewer's in. */
  newReplies: DigestThreadItem[];
  newRepliesTotal: number;
  /** Author-side: notes the viewer authored that are currently stalled. */
  stalledNotes: DigestStalledItem[];
  stalledNotesTotal: number;
  /** First digest? Lets the template prepend a welcome intro line. */
  isFirstDigest: boolean;
  /** Resolved lower-bound of the activity window (for footer attribution). */
  windowSince: Date;
};

export type BuildDigestArgs = {
  userId: string;
  /** When the previous digest was sent (null = never). */
  lastDigestSentAt: Date | null;
  /** Override "now" in tests / cron runs (default: `new Date()`). */
  now?: Date;
};

/**
 * Builds the digest payload for one user. Returns `null` when there's
 * nothing to send — the cron then skips the email entirely (the load-
 * bearing UX rule: never send empty digests).
 *
 * Activity window:
 *   - First digest: `now - 7 days`
 *   - Subsequent: `max(lastDigestSentAt, now - 7 days)` — guards against
 *     a user who paused digests for months then re-enabled them.
 */
export async function buildDigest({
  userId,
  lastDigestSentAt,
  now = new Date(),
}: BuildDigestArgs): Promise<DigestPayload | null> {
  const isFirstDigest = lastDigestSentAt === null;
  const lookbackFloor = new Date(now.getTime() - MAX_LOOKBACK_DAYS * MS_PER_DAY);
  const since =
    lastDigestSentAt && lastDigestSentAt > lookbackFloor
      ? lastDigestSentAt
      : lookbackFloor;

  const [newAssignments, newReplies, stalledNotes] = await Promise.all([
    loadNewAssignments(userId, since),
    loadNewReplies(userId, since),
    loadStalledNotes(userId, now),
  ]);

  if (
    newAssignments.items.length === 0 &&
    newReplies.items.length === 0 &&
    stalledNotes.items.length === 0
  ) {
    return null;
  }

  return {
    userId,
    newAssignments: newAssignments.items.slice(0, MAX_INLINE_ITEMS),
    newAssignmentsTotal: newAssignments.total,
    newReplies: newReplies.items.slice(0, MAX_INLINE_ITEMS),
    newRepliesTotal: newReplies.total,
    stalledNotes: stalledNotes.items.slice(0, MAX_INLINE_ITEMS),
    stalledNotesTotal: stalledNotes.total,
    isFirstDigest,
    windowSince: since,
  };
}

async function loadNewAssignments(
  userId: string,
  since: Date
): Promise<{ items: DigestNoteItem[]; total: number }> {
  const rows = await db.noteAssignment.findMany({
    where: {
      userId,
      // "New" = assignment row created since the lower bound. Catches both
      // newly authored notes and audience-edit additions (which also
      // create fresh NoteAssignment rows).
      createdAt: { gt: since },
    },
    include: {
      note: {
        select: {
          id: true,
          rehearsalId: true,
          noteType: true,
          bodyText: true,
          author: { select: { name: true, email: true } },
          audioAsset: {
            select: { transcript: true, transcriptStatus: true },
          },
          rehearsal: {
            select: {
              title: true,
              project: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    total: rows.length,
    items: rows.map((row) => ({
      noteId: row.note.id,
      rehearsalId: row.note.rehearsalId,
      projectTitle: row.note.rehearsal.project.title,
      rehearsalTitle: row.note.rehearsal.title,
      authorName: row.note.author.name?.trim() || row.note.author.email,
      bodyPreview: notePreview(row.note),
      isVoice: row.note.noteType === "VOICE",
    })),
  };
}

async function loadNewReplies(
  userId: string,
  since: Date
): Promise<{ items: DigestThreadItem[]; total: number }> {
  // Same scoping rules as `getUnreadCommentCountForUser`:
  // - Note thread comments are engagement-scoped (author OR assignee).
  // - Discussion thread comments are membership-scoped (anywhere visible).
  // Both exclude the user's own comments and soft-deleted ones, and
  // both filter to `createdAt > since` here so we count only this
  // window's worth.

  const [noteComments, discussionComments] = await Promise.all([
    db.noteComment.findMany({
      where: {
        createdAt: { gt: since },
        deletedAt: null,
        authorId: { not: userId },
        note: {
          OR: [
            { authorUserId: userId },
            { assignments: { some: { userId } } },
          ],
        },
      },
      select: {
        noteId: true,
        note: {
          select: {
            rehearsalId: true,
            author: { select: { name: true, email: true } },
            rehearsal: {
              select: { project: { select: { title: true } } },
            },
          },
        },
      },
    }),
    db.discussionComment.findMany({
      where: {
        createdAt: { gt: since },
        deletedAt: null,
        authorId: { not: userId },
        discussion: {
          project: { team: { members: { some: { userId } } } },
        },
      },
      select: {
        discussionId: true,
        discussion: {
          select: {
            rehearsalId: true,
            author: { select: { name: true, email: true } },
            project: { select: { title: true } },
          },
        },
      },
    }),
  ]);

  const byNote = new Map<string, DigestThreadItem>();
  for (const c of noteComments) {
    const existing = byNote.get(c.noteId);
    if (existing) {
      existing.newCommentCount += 1;
      continue;
    }
    byNote.set(c.noteId, {
      threadType: "note",
      entityId: c.noteId,
      rehearsalId: c.note.rehearsalId,
      projectTitle: c.note.rehearsal.project.title,
      threadLabel: `${firstName(c.note.author.name) ?? c.note.author.email}'s note`,
      newCommentCount: 1,
    });
  }

  const byDiscussion = new Map<string, DigestThreadItem>();
  for (const c of discussionComments) {
    const existing = byDiscussion.get(c.discussionId);
    if (existing) {
      existing.newCommentCount += 1;
      continue;
    }
    byDiscussion.set(c.discussionId, {
      threadType: "discussion",
      entityId: c.discussionId,
      rehearsalId: c.discussion.rehearsalId,
      projectTitle: c.discussion.project.title,
      threadLabel: `${firstName(c.discussion.author.name) ?? c.discussion.author.email}'s discussion`,
      newCommentCount: 1,
    });
  }

  const items = [...byNote.values(), ...byDiscussion.values()].sort(
    (a, b) => b.newCommentCount - a.newCommentCount
  );

  return { total: items.length, items };
}

async function loadStalledNotes(
  userId: string,
  now: Date
): Promise<{ items: DigestStalledItem[]; total: number }> {
  const stalledCutoff = new Date(
    now.getTime() - STALLED_THRESHOLD_DAYS * MS_PER_DAY
  );

  // Pre-filter to notes the user authored that are old enough to be
  // stalled — keeps the in-memory `isNoteStalled` pass small.
  const rows = await db.note.findMany({
    where: {
      authorUserId: userId,
      createdAt: { lt: stalledCutoff },
    },
    include: {
      audioAsset: {
        select: { transcript: true, transcriptStatus: true },
      },
      rehearsal: {
        select: { title: true, project: { select: { title: true } } },
      },
      assignments: { include: { status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const stalled: DigestStalledItem[] = [];
  for (const row of rows) {
    const assignments = row.assignments.map((a) => ({
      status: (a.status?.status ?? "OPEN") as NoteStatus,
    }));
    if (
      !isNoteStalled({ createdAt: row.createdAt, assignments, now })
    ) {
      continue;
    }
    const activeRecipientCount = assignments.filter(
      (a) => a.status === "OPEN" || a.status === "IN_PROGRESS"
    ).length;
    const ageInDays = Math.floor(
      (now.getTime() - row.createdAt.getTime()) / MS_PER_DAY
    );
    stalled.push({
      noteId: row.id,
      rehearsalId: row.rehearsalId,
      projectTitle: row.rehearsal.project.title,
      rehearsalTitle: row.rehearsal.title,
      bodyPreview: notePreview(row),
      isVoice: row.noteType === "VOICE",
      activeRecipientCount,
      ageInDays,
    });
  }

  // Oldest-stalled first so the email leads with the most urgent.
  stalled.sort((a, b) => b.ageInDays - a.ageInDays);
  return { total: stalled.length, items: stalled };
}

type PreviewableNote = {
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  audioAsset: {
    transcript: string | null;
    transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  } | null;
};

function notePreview(note: PreviewableNote): string {
  if (note.noteType === "VOICE") {
    if (
      note.audioAsset?.transcriptStatus === "READY" &&
      note.audioAsset.transcript
    ) {
      return truncate(note.audioAsset.transcript, PREVIEW_BODY_LENGTH);
    }
    return "Voice note";
  }
  return truncate(note.bodyText ?? "", PREVIEW_BODY_LENGTH);
}

function truncate(input: string, max: number): string {
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function firstName(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/u)[0] ?? trimmed;
}

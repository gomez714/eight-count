import type { AvatarTone } from "@/components/avatar-initials";
import type { NoteStatus } from "@/lib/notes/statuses";
import type { NoteTag } from "@/lib/notes/tags";

/**
 * Activity feed types — shared by the data layer ([get-activity-for-user.ts])
 * and the V2 dashboard's presentational primitives ([components/dashboard/]).
 *
 * The `ActivityItem` discriminated union is the public read shape. The
 * underlying source (today: parallel queries against Note / NoteComment /
 * NoteAssignmentStatus / Discussion / DiscussionComment) is an internal
 * detail of `getActivityForUser` — components that consume `ActivityItem`
 * never reach into Prisma directly. If we ever materialize an `Activity`
 * table, this contract stays stable.
 */

/* --------------------------------- actor -------------------------------- */

export type ActivityActor = {
  /** User id of the actor. */
  id: string;
  /** Display name. `null` only for users whose `name` was never set. */
  name: string | null;
  /** Deterministic avatar tone derived from `id` via `pickAvatarTone`. */
  tone: AvatarTone;
};

/* --------------------------------- scope -------------------------------- */

/**
 * Where in the org-hierarchy this activity happened. `rehearsal*` is
 * nullable because project-level discussions exist (`Discussion` rows
 * with `rehearsalId IS NULL`).
 */
export type ActivityScope = {
  teamId: string;
  teamName: string;
  projectId: string;
  projectTitle: string;
  rehearsalId: string | null;
  rehearsalTitle: string | null;
};

/* --------------------------------- items -------------------------------- */

type Base = {
  /** Composite key (`kind:dbId`) so React lists stay stable across kinds. */
  id: string;
  createdAt: Date;
  actor: ActivityActor;
  scope: ActivityScope;
};

/**
 * A new note was added to a rehearsal in one of the viewer's teams.
 * Covers both text and voice; `noteType` discriminates the body shape.
 *
 * `isForViewer` is true when the viewer is in the note's resolved audience
 * (assigned to them via EVERYONE, GROUP, or USER target). When true, the
 * UI surfaces "for you"; otherwise it surfaces the `audienceLabel`
 * ("for the cast", "for Front line", etc.).
 */
export type NoteAddedActivity = Base & {
  kind: "note-added";
  noteId: string;
  noteType: "TEXT" | "VOICE";
  bodyExcerpt: string | null;
  tag: NoteTag | null;
  /** ms within the rehearsal video where the note is anchored. */
  startTimestampMs: number;
  isForViewer: boolean;
  audienceLabel: string | null;
  /** Voice-only payload. Null for TEXT notes. */
  voice: {
    audioAssetId: string;
    durationMs: number | null;
    transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    transcript: string | null;
  } | null;
};

/**
 * Someone replied to a thread the viewer participates in. `parent`
 * discriminates note vs. discussion threads because they navigate to
 * different routes and carry different anchor context.
 *
 * Engagement-scoped for notes (viewer must be author or assignee — same
 * rule as the unread-comment count). Membership-scoped for discussions
 * (any discussion on a team the viewer belongs to).
 */
export type ThreadReplyActivity = Base & {
  kind: "thread-reply";
  commentId: string;
  bodyExcerpt: string;
  parent:
    | {
        type: "note";
        noteId: string;
        parentBodyExcerpt: string | null;
        parentStartTimestampMs: number;
      }
    | {
        type: "discussion";
        discussionId: string;
        parentBodyExcerpt: string | null;
        parentStartTimestampMs: number | null;
      };
};

/**
 * Someone changed status on an assignment for a note the viewer
 * authored. Surfaces "Iris marked your technique note Working" etc.
 *
 * Author-scoped — viewers see status changes on notes THEY wrote, not on
 * notes assigned to them. (The viewer's own status changes don't surface.)
 */
export type StatusChangeActivity = Base & {
  kind: "status-change";
  noteId: string;
  status: NoteStatus;
  noteBodyExcerpt: string | null;
  noteStartTimestampMs: number;
  noteTag: NoteTag | null;
};

/**
 * A new discussion was started in one of the viewer's teams.
 * `startTimestampMs` is null for project-level (unanchored) discussions.
 */
export type DiscussionStartedActivity = Base & {
  kind: "discussion-started";
  discussionId: string;
  noteType: "TEXT" | "VOICE";
  bodyExcerpt: string | null;
  startTimestampMs: number | null;
};

export type ActivityItem =
  | NoteAddedActivity
  | ThreadReplyActivity
  | StatusChangeActivity
  | DiscussionStartedActivity;

/* --------------------------------- page --------------------------------- */

export type ActivityFetchOptions = {
  /** Items per page. Defaults to 30 (matches the V2 mock spec). */
  limit?: number;
  /**
   * ISO date string. When present, fetch items strictly older than this
   * timestamp (used by "Show more" pagination).
   */
  cursor?: string;
  /**
   * Include activity authored BY the viewer. Defaults to `false` for the
   * normal feed (you don't want to see your own actions narrated back).
   *
   * The personal-workspace re-entry surface ([dashboard-v2.tsx]) passes
   * `true` so the viewer's own notes populate the "YOUR NOTES" stream.
   */
  includeSelf?: boolean;
  /**
   * Maximum age of items to consider, in days. Defaults to 30.
   * Items older than this never appear regardless of cursor.
   */
  windowDays?: number;
};

export type ActivityPage = {
  items: ActivityItem[];
  /** True when more pages exist beyond `nextCursor`. */
  hasMore: boolean;
  /** ISO date of the oldest item in this page. Pass back as `cursor`. */
  nextCursor: string | null;
};

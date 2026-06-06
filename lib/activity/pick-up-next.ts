import type { NoteTag } from "@/lib/notes/tags";

import type { ActivityActor, ActivityScope } from "./types";

/**
 * Up Next priority pick — the pinned card at the top of the V2 dashboard
 * feed. Pure function so the page can construct it from pre-fetched
 * inputs and tests can drive it deterministically.
 *
 * Priority order (locked per the build plan):
 *   1. oldest-unresolved — viewer's oldest active assignment
 *   2. unfinished-rehearsal — most recent rehearsal where viewer is staff,
 *      a video is READY, and viewer hasn't authored a note yet
 *   3. unread-thread — most recent thread comment newer than viewer's
 *      lastViewedAt on a thread viewer participates in
 *   4. first-note — fallthrough for engaged-but-nothing-assigned users
 *      with at least one ready rehearsal to leave a note on
 *   5. null — brand-new user (no teams) gets the WelcomeCard instead
 *
 * The eyebrow `whyLine` is part of the output so the algorithm and the
 * justification stay synchronized — if the picker logic changes, the
 * eyebrow text changes with it (no drift between behavior and UI copy).
 */

/* --------------------------------- inputs --------------------------------- */

export type OldestUnresolvedInput = {
  noteId: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  startTimestampMs: number;
  tag: NoteTag | null;
  /** Set when the viewer's assignment on this note is in a repeating cluster. */
  repeatingCount: number | null;
  author: ActivityActor;
  scope: ActivityScope;
  /** Used for tie-breaking and "oldest" determination. */
  assignedAt: Date;
  /**
   * True when the viewer is the note's author (typical in personal-workspace
   * mode where the user leaves themselves notes). The pin card uses this to
   * render "Your own note" instead of the user's own name as the byline.
   */
  selfAuthored: boolean;
};

export type UnfinishedRehearsalInput = {
  rehearsalId: string;
  rehearsalTitle: string;
  /** ms within the video to open at. v1: always 0 (start of video). */
  startTimestampMs: number;
  scope: ActivityScope;
  /** Used for "most recent" determination. */
  videoReadyAt: Date;
};

export type UnreadThreadInput = {
  parent:
    | { type: "note"; noteId: string }
    | { type: "discussion"; discussionId: string };
  /** Most recent unread reply body. */
  bodyExcerpt: string | null;
  /** Latest reply's author. */
  replyAuthor: ActivityActor;
  /** Original parent's author, for the eyebrow's "from {name}" rendering. */
  parentAuthor: ActivityActor;
  parentBodyExcerpt: string | null;
  parentStartTimestampMs: number | null;
  scope: ActivityScope;
  unreadCount: number;
  /** Used for "most recent" determination. */
  latestReplyAt: Date;
};

export type FirstNoteInput = {
  /** Most recent rehearsal with a READY video the viewer can leave a note on. */
  rehearsalId: string;
  rehearsalTitle: string;
  scope: ActivityScope;
};

export type UpNextPickInput = {
  oldestUnresolved: OldestUnresolvedInput | null;
  unfinishedRehearsal: UnfinishedRehearsalInput | null;
  unreadThread: UnreadThreadInput | null;
  firstNoteCandidate: FirstNoteInput | null;
};

/* --------------------------------- outputs -------------------------------- */

type BasePick = {
  whyLine: string;
};

export type UpNextOldestUnresolved = BasePick & {
  reason: "oldest-unresolved";
  data: OldestUnresolvedInput;
};

export type UpNextUnfinishedRehearsal = BasePick & {
  reason: "unfinished-rehearsal";
  data: UnfinishedRehearsalInput;
};

export type UpNextUnreadThread = BasePick & {
  reason: "unread-thread";
  data: UnreadThreadInput;
};

export type UpNextFirstNote = BasePick & {
  reason: "first-note";
  data: FirstNoteInput;
};

export type UpNextPick =
  | UpNextOldestUnresolved
  | UpNextUnfinishedRehearsal
  | UpNextUnreadThread
  | UpNextFirstNote;

/* -------------------------------- function -------------------------------- */

export function pickUpNext(input: UpNextPickInput): UpNextPick | null {
  // 1. Oldest unresolved assignment — strongest signal of "you owe
  // someone follow-through on something specific."
  if (input.oldestUnresolved) {
    const why = input.oldestUnresolved.repeatingCount
      ? "Oldest unresolved · keeps repeating"
      : "Your oldest open note";
    return {
      reason: "oldest-unresolved",
      whyLine: why,
      data: input.oldestUnresolved,
    };
  }

  // 2. Unfinished rehearsal — staff users with a video uploaded but no
  // notes left yet. The dancer-side equivalent never fires because dancers
  // can't author notes.
  if (input.unfinishedRehearsal) {
    return {
      reason: "unfinished-rehearsal",
      whyLine: "Pick up where you left off",
      data: input.unfinishedRehearsal,
    };
  }

  // 3. Unread thread — someone replied and you haven't seen it. Lower
  // priority than your own work, but worth surfacing before fallthrough.
  if (input.unreadThread) {
    const count = input.unreadThread.unreadCount;
    return {
      reason: "unread-thread",
      whyLine: count > 1 ? `${count} new replies waiting` : "New reply waiting",
      data: input.unreadThread,
    };
  }

  // 4. First-note fallthrough — engaged user (in a team with a video
  // ready) but nothing assigned and nothing unread. The card morphs into
  // a "leave your first note" invitation.
  if (input.firstNoteCandidate) {
    return {
      reason: "first-note",
      whyLine: "Nothing assigned yet — start the conversation",
      data: input.firstNoteCandidate,
    };
  }

  return null;
}

/* --------------------------------- guards --------------------------------- */

/**
 * Type guard — useful when the page narrows on `pick.reason` before
 * rendering a specific variant.
 */
export function isUpNextReason<R extends UpNextPick["reason"]>(
  pick: UpNextPick | null,
  reason: R
): pick is Extract<UpNextPick, { reason: R }> {
  return pick !== null && pick.reason === reason;
}

/**
 * Re-export of the AvatarTone type so callers building actor records
 * don't have to chase the import down through `@/components/avatar-initials`.
 */
export type { AvatarTone } from "@/components/avatar-initials";

import type { ThreadReactionSummary } from "@/lib/threads/comments";
import type { NoteStatus } from "@/lib/notes/statuses";
import type { NoteTag } from "@/lib/notes/tags";

export type AuthoredAssignmentCounts = Record<NoteStatus, number>;

export type AuthoredRepeatingMarker = {
  tag: NoteTag;
  count: number;
};

export type AuthoredThreadSummary = {
  commentCount: number;
  reactions: ThreadReactionSummary[];
  hasUnread: boolean;
};

export type AuthoredNoteFilter =
  | "ALL"
  | "OUTSTANDING"
  | "STALLED"
  | "COMPLETE"
  | "UNASSIGNED";

export type AuthoredNoteSort = "STALLED_FIRST" | "RECENT" | "OLDEST";

export type AuthoredNoteTarget = {
  id: string;
  kind: "EVERYONE" | "GROUP" | "USER";
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  group: { id: string; name: string } | null;
};

export type AuthoredNoteAssignment = {
  id: string;
  status: NoteStatus;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  repeating: AuthoredRepeatingMarker | null;
};

export type AuthoredNoteAudio = {
  id: string;
  mimeType: string;
  durationMs: number | null;
  transcript: string | null;
  transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
};

export type AuthoredNoteRow = {
  id: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  startTimestampMs: number;
  endTimestampMs: number | null;
  tag: NoteTag | null;
  audioAsset: AuthoredNoteAudio | null;
  createdAt: string | Date;
  targets: AuthoredNoteTarget[];
  assignments: AuthoredNoteAssignment[];
  assignmentCounts: AuthoredAssignmentCounts;
  /** Authored more than 3 days ago and still has any active assignment. */
  stalled: boolean;
  /** True if any of this note's assignments are part of a repeating cluster. */
  hasRepeating: boolean;
  thread: AuthoredThreadSummary;
  rehearsal: {
    id: string;
    title: string;
    rehearsalDate: string | Date;
    project: {
      id: string;
      title: string;
      team: { id: string; name: string };
    };
  };
};

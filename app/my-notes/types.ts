import type { ThreadReactionSummary } from "@/lib/threads/comments";
import type { NoteStatus } from "@/lib/notes/statuses";
import type { NoteTag } from "@/lib/notes/tags";

export { NOTE_STATUSES, NOTE_STATUS_LABELS } from "@/lib/notes/statuses";
export type { NoteStatus } from "@/lib/notes/statuses";

export type RepeatingMarker = {
  tag: NoteTag;
  count: number;
};

export type AssignedNoteThreadSummary = {
  commentCount: number;
  reactions: ThreadReactionSummary[];
  hasUnread: boolean;
};

export const DEFAULT_EXPANDED_STATUSES: Record<NoteStatus, boolean> = {
  OPEN: true,
  IN_PROGRESS: true,
  ADDRESSED: false,
  RESOLVED: false,
};

export type MyNotesFilter = {
  authorId: string | null;
  projectId: string | null;
  // When set, narrows the queue to notes from a single rehearsal. Currently
  // only set via the `?rehearsal=<id>` URL param (driven by the "Drill from
  // this rehearsal" button on the workspace). Coexists with `projectId`:
  // a rehearsal belongs to one project, so the rehearsal filter is always
  // the narrower of the two when both are set.
  rehearsalId: string | null;
  noteType: "TEXT" | "VOICE" | null;
  tag: NoteTag | null;
};

export const EMPTY_FILTER: MyNotesFilter = {
  authorId: null,
  projectId: null,
  rehearsalId: null,
  noteType: null,
  tag: null,
};

export type TagOption = {
  tag: NoteTag;
  count: number;
};

export type AuthorOption = {
  id: string;
  name: string;
  email: string;
  count: number;
};

export type ProjectOption = {
  id: string;
  title: string;
  count: number;
};

export type TypeCounts = {
  TEXT: number;
  VOICE: number;
};

export type AssignedNoteTarget = {
  id: string;
  kind: "EVERYONE" | "GROUP" | "USER";
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  group: { id: string; name: string } | null;
};

export type AssignedNoteAudio = {
  id: string;
  mimeType: string;
  durationMs: number | null;
  transcript: string | null;
  transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
};

export type AssignedNoteRow = {
  id: string;
  status: NoteStatus;
  repeating: RepeatingMarker | null;
  note: {
    id: string;
    noteType: "TEXT" | "VOICE";
    bodyText: string | null;
    /**
     * Null when the note has no video anchor — the row renders a
     * `NoteCreatedAtPill` (relative-date) in place of `NoteTimestampPill`.
     * Voice rows in standalone mode get the same fallback for their
     * timestamp meta line.
     */
    startTimestampMs: number | null;
    endTimestampMs: number | null;
    tag: NoteTag | null;
    audioAsset: AssignedNoteAudio | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    author: {
      id: string;
      name: string | null;
      email: string;
    };
    targets: AssignedNoteTarget[];
    thread: AssignedNoteThreadSummary;
    rehearsal: {
      id: string;
      title: string;
      rehearsalDate: string | Date;
      project: {
        id: string;
        title: string;
        team: {
          id: string;
          name: string;
        };
      };
    };
  };
};

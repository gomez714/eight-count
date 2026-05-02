import type { NoteStatus } from "@/lib/notes/statuses";

export { NOTE_STATUSES, NOTE_STATUS_LABELS } from "@/lib/notes/statuses";
export type { NoteStatus } from "@/lib/notes/statuses";

export const DEFAULT_EXPANDED_STATUSES: Record<NoteStatus, boolean> = {
  OPEN: true,
  IN_PROGRESS: true,
  ADDRESSED: false,
  RESOLVED: false,
};

export type MyNotesFilter = {
  authorId: string | null;
  projectId: string | null;
  noteType: "TEXT" | "VOICE" | null;
};

export const EMPTY_FILTER: MyNotesFilter = {
  authorId: null,
  projectId: null,
  noteType: null,
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
};

export type AssignedNoteRow = {
  id: string;
  status: NoteStatus;
  note: {
    id: string;
    noteType: "TEXT" | "VOICE";
    bodyText: string | null;
    startTimestampMs: number;
    endTimestampMs: number | null;
    audioAsset: AssignedNoteAudio | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    author: {
      id: string;
      name: string | null;
      email: string;
    };
    targets: AssignedNoteTarget[];
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

import type { NoteStatus } from "@/lib/notes/statuses";

export { NOTE_STATUSES, NOTE_STATUS_LABELS } from "@/lib/notes/statuses";
export type { NoteStatus } from "@/lib/notes/statuses";

export const DEFAULT_EXPANDED_STATUSES: Record<NoteStatus, boolean> = {
  OPEN: true,
  IN_PROGRESS: true,
  ADDRESSED: false,
  RESOLVED: false,
};

export type AssignedNoteRow = {
  id: string;
  status: NoteStatus;
  note: {
    id: string;
    bodyText: string;
    timestampMs: number;
    createdAt: string | Date;
    author: {
      id: string;
      name: string | null;
      email: string;
    };
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

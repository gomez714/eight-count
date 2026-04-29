export const NOTE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "ADDRESSED",
  "RESOLVED",
] as const;

export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ADDRESSED: "Addressed",
  RESOLVED: "Resolved",
};

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

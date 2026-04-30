import type { NoteStatus } from "@/lib/notes/statuses";

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
};

export type AuthoredNoteRow = {
  id: string;
  bodyText: string;
  timestampMs: number;
  createdAt: string | Date;
  targets: AuthoredNoteTarget[];
  assignments: AuthoredNoteAssignment[];
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

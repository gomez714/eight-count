export type AssignableMember = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";
};

export type NoteAssignmentStatusItem = {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "ADDRESSED" | "RESOLVED";
};

export type NoteAssignmentItem = {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  status: NoteAssignmentStatusItem | null;
};

export type NoteTargetItem = {
  id: string;
  kind: "EVERYONE" | "GROUP" | "USER";
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  group: { id: string; name: string } | null;
};

export type AvailableGroup = {
  id: string;
  name: string;
  /** User IDs of group members (resolved from TeamMember -> User). */
  memberUserIds: string[];
};

export type NoteItem = {
  id: string;
  bodyText: string;
  timestampMs: number;
  createdAt: string | Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  assignments: NoteAssignmentItem[];
  targets: NoteTargetItem[];
};
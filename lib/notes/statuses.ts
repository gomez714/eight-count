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

export function isActiveStatus(status: NoteStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}

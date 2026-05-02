import { isActiveStatus, type NoteStatus } from "./statuses";

/**
 * A note is "stalled" when it was authored more than this many days ago
 * and at least one assignment is still active (OPEN or IN_PROGRESS).
 */
export const STALLED_THRESHOLD_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type StalledInput = {
  createdAt: Date | string;
  assignments: ReadonlyArray<{ status: NoteStatus }>;
  /**
   * Override "now" in tests / deterministic contexts.
   */
  now?: Date;
};

export function isNoteStalled({
  createdAt,
  assignments,
  now = new Date(),
}: StalledInput): boolean {
  if (assignments.length === 0) return false;

  const created =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  const ageMs = now.getTime() - created.getTime();
  if (ageMs < STALLED_THRESHOLD_DAYS * MS_PER_DAY) return false;

  return assignments.some((assignment) => isActiveStatus(assignment.status));
}

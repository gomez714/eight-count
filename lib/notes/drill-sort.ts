/**
 * Drill-view row priority sort.
 *
 * Within a tag bucket, ordering is essentially arbitrary today. This helper
 * imposes a deterministic "do this first" order so dancers and staff see
 * the highest-leverage items at the top of each tag section:
 *
 *   1. Rows in a repeating cluster (their tag's cluster)
 *   2. Oldest unresolved first (ascending `createdAt`)
 *   3. Newest rehearsal next (descending `rehearsalDate`)
 *   4. Tiebreaker by `id` for full determinism
 *
 * Drill view only renders OPEN / IN_PROGRESS rows, so "oldest unresolved"
 * is just "oldest" — no extra status filter inside the sort.
 *
 * The helper is parametric over row type via an accessor so that both
 * surfaces can use it without sharing a row shape:
 *   - `/my-notes?view=drill` operates on `AssignedNoteRow` (nested Note)
 *   - `/projects/[id]` project drill board operates on `DrillItem` (flat
 *     view model already built server-side)
 */

export type DrillPriorityKey = {
  isRepeating: boolean;
  createdAtMs: number;
  rehearsalDateMs: number;
  tiebreaker: string;
};

export function compareDrillPriority(
  a: DrillPriorityKey,
  b: DrillPriorityKey,
): number {
  if (a.isRepeating !== b.isRepeating) return a.isRepeating ? -1 : 1;
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  if (a.rehearsalDateMs !== b.rehearsalDateMs) {
    return b.rehearsalDateMs - a.rehearsalDateMs;
  }
  return a.tiebreaker.localeCompare(b.tiebreaker);
}

export function sortByDrillPriority<T>(
  rows: ReadonlyArray<T>,
  toKey: (row: T) => DrillPriorityKey,
): T[] {
  return [...rows].sort((a, b) => compareDrillPriority(toKey(a), toKey(b)));
}

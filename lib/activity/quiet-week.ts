import type { ActivityItem } from "./types";

/**
 * Quiet-week detection — the dashboard switches to the "quiet week" empty
 * state when there's been zero activity in the trailing 7 days across all
 * of the viewer's teams.
 *
 * Threshold is exposed so the dashboard can also surface "Your last note
 * from {actor} was N days ago" in the same warm copy.
 */

export const QUIET_WINDOW_DAYS = 7;

const QUIET_WINDOW_MS = QUIET_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Pure: returns true when none of `items` falls within the last
 * QUIET_WINDOW_DAYS, measured from `now`. `now` is injectable so tests
 * stay deterministic.
 */
export function isQuietWeek(
  items: ReadonlyArray<Pick<ActivityItem, "createdAt">>,
  now: Date = new Date()
): boolean {
  const threshold = now.getTime() - QUIET_WINDOW_MS;
  return !items.some((item) => item.createdAt.getTime() >= threshold);
}

/**
 * Pure: returns the most recent activity item across all input (or `null`
 * if empty). Used by the quiet-week copy to surface "Your last note from
 * {actor} was {N} days ago" — the page can read `actor.name` + age from
 * the returned item.
 */
export function pickMostRecent<T extends { createdAt: Date }>(
  items: ReadonlyArray<T>
): T | null {
  if (items.length === 0) return null;
  let head = items[0];
  for (let i = 1; i < items.length; i += 1) {
    const candidate = items[i];
    if (candidate.createdAt.getTime() > head.createdAt.getTime()) {
      head = candidate;
    }
  }
  return head;
}

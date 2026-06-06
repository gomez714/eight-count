/**
 * Relative-date formatter for surfaces that need to render a Date in a
 * compact, human-readable way:
 *   - same day → time of day ("7:23 PM")
 *   - yesterday → "Yesterday"
 *   - within ~6 days → weekday short ("Tue")
 *   - older → month + day ("Jun 6")
 *
 * Returns both a `short` label (for the pill / cell) and a `long` label
 * (for `title=`/aria, e.g. "Today at 7:23 PM"). Stable across locale via
 * `toLocaleTimeString` / `toLocaleDateString` defaults.
 *
 * Used by:
 *   - `NoteCreatedAtPill` (workspace + my-notes / notes-by-me row pills)
 *   - `DrillRow` (when a drill row's note has no video anchor)
 *   - `RepeatingClusterDetails` (when a cluster's items have no anchor)
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type RelativeDateLabels = {
  short: string;
  long: string;
};

export function formatRelativeDate(value: Date | string): RelativeDateLabels {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) {
    return { short: time, long: `Today at ${time}` };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) {
    return { short: "Yesterday", long: `Yesterday at ${time}` };
  }

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < MS_PER_DAY * 6) {
    const weekday = date.toLocaleDateString(undefined, {
      weekday: "short",
    });
    return { short: weekday, long: `${weekday} at ${time}` };
  }

  const monthDay = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return { short: monthDay, long: `${monthDay} at ${time}` };
}

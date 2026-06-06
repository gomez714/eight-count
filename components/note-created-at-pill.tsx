import { Clock } from "lucide-react";

import { formatRelativeDate } from "@/lib/notes/format-relative-date";

type NoteCreatedAtPillProps = {
  createdAt: Date | string;
  /** Renders a muted variant for inline meta rows. */
  size?: "sm" | "md";
};

/**
 * Muted pill that surfaces when a note has no video anchor — the
 * "Notes without anchor" fallback for the timestamp pill. Renders a
 * relative-date short label with the full date/time exposed via
 * `title=` for hover/long-press disclosure.
 */
export function NoteCreatedAtPill({
  createdAt,
  size = "sm",
}: NoteCreatedAtPillProps) {
  const { short, long } = formatRelativeDate(createdAt);

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-1 text-xs"
      : "px-2 py-0.5 text-[11px]";

  return (
    <span
      title={long}
      aria-label={`No video anchor — created ${long}`}
      className={`inline-flex items-center gap-1 rounded-md border border-dashed border-border bg-muted/40 font-medium text-muted-foreground ${sizeClasses}`}
    >
      <Clock aria-hidden className="size-3" />
      <span className="tabular-nums">{short}</span>
    </span>
  );
}

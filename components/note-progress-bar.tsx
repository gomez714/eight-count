import type { CSSProperties } from "react";

import type { NoteStatus } from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

export type NoteProgressCounts = Record<NoteStatus, number>;

type NoteProgressBarProps = {
  counts: NoteProgressCounts;
  height?: number;
  className?: string;
};

const SEGMENT_ORDER: ReadonlyArray<{ status: NoteStatus; color: string }> = [
  { status: "RESOLVED", color: "var(--status-resolved-fg)" },
  { status: "ADDRESSED", color: "var(--status-addressed-fg)" },
  { status: "IN_PROGRESS", color: "var(--status-progress-fg)" },
  { status: "OPEN", color: "var(--status-open-fg)" },
];

export function NoteProgressBar({
  counts,
  height = 6,
  className,
}: Readonly<NoteProgressBarProps>) {
  const total =
    counts.OPEN + counts.IN_PROGRESS + counts.ADDRESSED + counts.RESOLVED;

  if (total === 0) {
    return null;
  }

  const visibleSegments = SEGMENT_ORDER.filter((seg) => counts[seg.status] > 0);

  const trackStyle: CSSProperties = {
    height,
    backgroundColor: "var(--status-open-bg)",
  };

  return (
    <div
      className={cn("flex gap-px overflow-hidden rounded-full", className)}
      style={trackStyle}
    >
      {visibleSegments.map((seg) => (
        <span
          key={seg.status}
          data-status={seg.status}
          className="h-full"
          style={{
            flex: counts[seg.status],
            backgroundColor: seg.color,
          }}
        />
      ))}
    </div>
  );
}

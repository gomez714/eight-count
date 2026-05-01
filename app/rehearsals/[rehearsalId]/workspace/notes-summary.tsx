import type { NoteStatus } from "@/lib/notes/statuses";

import { StatusDot } from "./status-chip";
import type { NoteItem } from "./types";

type NotesSummaryProps = {
  notes: NoteItem[];
};

type AssignmentCounts = Record<NoteStatus, number>;

function computeAssignmentCounts(notes: NoteItem[]): AssignmentCounts {
  const counts: AssignmentCounts = {
    OPEN: 0,
    IN_PROGRESS: 0,
    ADDRESSED: 0,
    RESOLVED: 0,
  };
  for (const note of notes) {
    for (const assignment of note.assignments) {
      const status = assignment.status?.status ?? "OPEN";
      counts[status] += 1;
    }
  }
  return counts;
}

const SEGMENT_ORDER: Array<{ status: NoteStatus; color: string }> = [
  { status: "RESOLVED", color: "var(--status-resolved-fg)" },
  { status: "ADDRESSED", color: "var(--status-addressed-fg)" },
  { status: "IN_PROGRESS", color: "var(--status-progress-fg)" },
  { status: "OPEN", color: "var(--status-open-fg)" },
];

export function NotesSummary({ notes }: NotesSummaryProps) {
  const counts = computeAssignmentCounts(notes);
  const total =
    counts.OPEN + counts.IN_PROGRESS + counts.ADDRESSED + counts.RESOLVED;

  if (total === 0) {
    return null;
  }

  const closed = counts.ADDRESSED + counts.RESOLVED;
  const visibleSegments = SEGMENT_ORDER.filter((seg) => counts[seg.status] > 0);

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
            {closed}
            <span className="font-medium text-muted-foreground">/{total}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            addressed or resolved
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <StatusDot status="OPEN" />
            <span className="font-semibold tabular-nums text-foreground">
              {counts.OPEN}
            </span>
            <span>open</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StatusDot status="IN_PROGRESS" />
            <span
              className="font-semibold tabular-nums"
              style={{ color: "var(--status-progress-fg)" }}
            >
              {counts.IN_PROGRESS}
            </span>
            <span>in progress</span>
          </span>
        </div>
      </div>

      <div
        className="flex h-1.5 gap-px overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--status-open-bg)" }}
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
    </div>
  );
}

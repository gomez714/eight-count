import { ArrowRight, Clock, Repeat } from "lucide-react";
import type { CSSProperties } from "react";

import { NoteProgressBar } from "@/components/note-progress-bar";
import type { NoteStatus } from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import type { AuthoredAssignmentCounts } from "./types";

type AuthorSummaryStripProps = {
  totalAssignments: number;
  addressed: number;
  stalledCount: number;
  unassignedCount: number;
  repeatingDancerCount: number;
  aggregateCounts: AuthoredAssignmentCounts;
  onJumpToStalled?: () => void;
};

const SEGMENTS: ReadonlyArray<{ status: NoteStatus; color: string; label: string }> = [
  { status: "RESOLVED", color: "var(--status-resolved-fg)", label: "resolved" },
  { status: "ADDRESSED", color: "var(--status-addressed-fg)", label: "addressed" },
  { status: "IN_PROGRESS", color: "var(--status-progress-fg)", label: "in progress" },
  { status: "OPEN", color: "var(--status-open-fg)", label: "open" },
];

export function AuthorSummaryStrip({
  totalAssignments,
  addressed,
  stalledCount,
  unassignedCount,
  repeatingDancerCount,
  aggregateCounts,
  onJumpToStalled,
}: Readonly<AuthorSummaryStripProps>) {
  const followThroughPct =
    totalAssignments > 0
      ? Math.round((addressed / totalAssignments) * 100)
      : 0;

  const visibleLegend = SEGMENTS.filter(
    (seg) => aggregateCounts[seg.status] > 0
  );

  const stalledStyle: CSSProperties =
    stalledCount > 0
      ? {
          backgroundColor: "var(--status-progress-bg)",
          borderColor: "var(--status-progress-border)",
        }
      : {
          backgroundColor: "var(--muted)",
          borderColor: "var(--border)",
        };

  const showRepeating = repeatingDancerCount > 0;

  return (
    <div
      className={cn(
        "grid gap-4 rounded-lg border bg-card p-5",
        showRepeating
          ? "lg:grid-cols-[1.6fr_1fr_1fr_1fr]"
          : "lg:grid-cols-[1.6fr_1fr_1fr]"
      )}
    >
      {/* Follow-through */}
      <section className="flex flex-col gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Follow-through
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
              {followThroughPct}%
            </span>
            <span className="text-xs text-muted-foreground">
              of {totalAssignments}{" "}
              {totalAssignments === 1 ? "assignment" : "assignments"} addressed
            </span>
          </div>
        </div>
        <NoteProgressBar counts={aggregateCounts} height={8} />
        {visibleLegend.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {visibleLegend.map((seg) => (
              <span
                key={seg.status}
                className="inline-flex items-center gap-1.5"
              >
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="font-semibold tabular-nums text-foreground">
                  {aggregateCounts[seg.status]}
                </span>{" "}
                {seg.label}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {/* Stalled */}
      <section
        className="flex flex-col gap-1.5 rounded-md border p-3"
        style={stalledStyle}
      >
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider",
            stalledCount > 0
              ? ""
              : "text-muted-foreground"
          )}
          style={
            stalledCount > 0
              ? { color: "var(--status-progress-fg)" }
              : undefined
          }
        >
          <Clock aria-hidden className="size-3" /> Stalled
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-2xl font-semibold leading-none tracking-tight tabular-nums"
            style={
              stalledCount > 0
                ? { color: "var(--status-progress-fg)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {stalledCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {stalledCount === 1 ? "note · 3+ days open" : "notes · 3+ days open"}
          </span>
        </div>
        {stalledCount > 0 && onJumpToStalled ? (
          <button
            type="button"
            onClick={onJumpToStalled}
            className="mt-1 inline-flex items-center gap-1 self-start text-xs font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded"
            style={{ color: "var(--status-progress-fg)" }}
          >
            Triage now <ArrowRight aria-hidden className="size-3" />
          </button>
        ) : null}
      </section>

      {/* Repeating */}
      {showRepeating ? (
        <section
          className="flex flex-col gap-1.5 rounded-md border p-3"
          style={{
            backgroundColor: "var(--repeating-bg)",
            borderColor: "var(--repeating-border)",
          }}
        >
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--repeating-fg)" }}
          >
            <Repeat aria-hidden className="size-3" /> Repeating
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-2xl font-semibold leading-none tracking-tight tabular-nums"
              style={{ color: "var(--repeating-fg)" }}
            >
              {repeatingDancerCount}
            </span>
            <span className="text-xs text-muted-foreground">
              {repeatingDancerCount === 1 ? "dancer" : "dancers"} keep getting the same note
            </span>
          </div>
        </section>
      ) : null}

      {/* Unassigned */}
      <section className="flex flex-col gap-1.5 rounded-md border border-dashed border-border bg-muted/40 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Unassigned
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
            {unassignedCount}
          </span>
          <span className="text-xs text-muted-foreground">
            no one on the hook
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Group / cast notes don&apos;t track per-person status until assigned.
        </span>
      </section>
    </div>
  );
}

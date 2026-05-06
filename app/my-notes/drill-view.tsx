"use client";

import { Printer, Repeat } from "lucide-react";
import { useEffect } from "react";

import { DrillRow, type DrillRowItem } from "@/components/drill/drill-row";
import { DrillTagSection } from "@/components/drill/drill-tag-section";
import { RepeatingChip } from "@/components/repeating-chip";
import { Button } from "@/components/ui/button";
import { NOTE_TAGS, type NoteTag } from "@/lib/notes/tags";

import type { AssignedNoteRow, RepeatingMarker } from "./types";

type DrillViewProps = {
  rows: AssignedNoteRow[];
  /**
   * When the user has open notes across 2+ projects, each row shows its
   * project name so they always know which show they're drilling.
   */
  showProjectInRows: boolean;
  /**
   * Set when the user has open notes in 2+ projects AND the current
   * project filter has narrowed them to one. Surfaces a "Showing from X"
   * header with a link to clear the filter.
   */
  singleProjectHeader: {
    projectName: string;
    onClearProjectFilter: () => void;
  } | null;
  /**
   * Total active rows the user has across ALL projects (ignoring the
   * current filter). Lets the empty state distinguish "globally caught
   * up" from "filtered into a project with nothing to drill."
   */
  totalActiveRowsUnfiltered: number;
};

type TagBucket = {
  tag: NoteTag | null;
  rows: AssignedNoteRow[];
  isRepeating: boolean;
  repeatingCount: number;
};

const ACTIVE_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);

function bucketRows(rows: AssignedNoteRow[]): TagBucket[] {
  const active = rows.filter((row) => ACTIVE_STATUSES.has(row.status));
  const buckets = new Map<NoteTag | "OTHER", TagBucket>();
  for (const row of active) {
    const key = row.note.tag ?? "OTHER";
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        tag: row.note.tag,
        rows: [],
        isRepeating: false,
        repeatingCount: 0,
      };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
    if (row.repeating) {
      bucket.isRepeating = true;
      // Count is consistent within a cluster so the largest value wins.
      bucket.repeatingCount = Math.max(bucket.repeatingCount, row.repeating.count);
    }
  }

  return [...NOTE_TAGS, null]
    .map((tag) => {
      const key = tag ?? "OTHER";
      return buckets.get(key as NoteTag | "OTHER") ?? null;
    })
    .filter((b): b is TagBucket => b !== null);
}

function uniqueRepeatingClusters(rows: AssignedNoteRow[]): RepeatingMarker[] {
  const seen = new Map<string, RepeatingMarker>();
  for (const row of rows) {
    if (!row.repeating) continue;
    const key = `${row.repeating.tag}-${row.repeating.count}`;
    if (!seen.has(key)) seen.set(key, row.repeating);
  }
  return [...seen.values()];
}

function toDrillItem(row: AssignedNoteRow): DrillRowItem {
  // Only surface the transcript when it's actually READY — otherwise the
  // row falls back to the existing "Voice note · 0:32" placeholder, which
  // is honest for PROCESSING / FAILED states.
  const voiceTranscript =
    row.note.audioAsset?.transcriptStatus === "READY"
      ? (row.note.audioAsset.transcript ?? null)
      : null;

  return {
    rehearsalId: row.note.rehearsal.id,
    rehearsalTitle: row.note.rehearsal.title,
    noteType: row.note.noteType,
    bodyText: row.note.bodyText,
    voiceTranscript,
    audioDurationMs: row.note.audioAsset?.durationMs ?? null,
    startTimestampMs: row.note.startTimestampMs,
    status: row.status,
  };
}

export function DrillView({
  rows,
  showProjectInRows,
  singleProjectHeader,
  totalActiveRowsUnfiltered,
}: Readonly<DrillViewProps>) {
  // Mark the body so the @media print rules in globals.css fire while drill
  // mode is mounted. Cleans up on unmount so other pages aren't affected.
  useEffect(() => {
    document.body.dataset.printTarget = "drill";
    return () => {
      delete document.body.dataset.printTarget;
    };
  }, []);

  const buckets = bucketRows(rows);
  const totalActive = buckets.reduce((acc, b) => acc + b.rows.length, 0);
  const recurringClusters = uniqueRepeatingClusters(rows);

  if (totalActive === 0) {
    // Differentiate: filtered to a project that has nothing active vs.
    // genuinely caught up across the whole inbox.
    const isFilteredEmpty =
      singleProjectHeader !== null && totalActiveRowsUnfiltered > 0;
    return (
      <div className="flex flex-col gap-3">
        {singleProjectHeader ? (
          <SingleProjectHeader header={singleProjectHeader} count={0} />
        ) : null}
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          {isFilteredEmpty ? (
            <>
              No drills in this project — but you have{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {totalActiveRowsUnfiltered}
              </span>{" "}
              active{" "}
              {totalActiveRowsUnfiltered === 1 ? "note" : "notes"} in other
              projects.{" "}
              <button
                type="button"
                onClick={singleProjectHeader.onClearProjectFilter}
                className="text-foreground underline outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                See all projects
              </button>
              {"."}
            </>
          ) : (
            "Nothing to drill — every note assigned to you is addressed or resolved."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        data-print-hidden
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <p className="text-sm text-muted-foreground">
          {totalActive} {totalActive === 1 ? "note" : "notes"} to drill, grouped by tag.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => globalThis.print()}
        >
          <Printer aria-hidden className="size-3.5" />
          Print
        </Button>
      </div>

      {/* Print-only header — hidden on screen, shown on paper */}
      <div data-print-only className="hidden flex-col gap-1 pb-2">
        <h2 className="text-lg font-semibold">Drill list</h2>
        <p className="text-xs text-muted-foreground">
          Generated{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
          }).format(new Date())}
        </p>
      </div>

      {singleProjectHeader ? (
        <SingleProjectHeader header={singleProjectHeader} count={totalActive} />
      ) : null}

      {recurringClusters.length > 0 ? (
        <section
          className="flex flex-col gap-2 rounded-lg border p-4"
          style={{
            backgroundColor: "var(--repeating-bg)",
            borderColor: "var(--repeating-border)",
          }}
        >
          <h3
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: "var(--repeating-fg)" }}
          >
            <Repeat aria-hidden className="size-4" />
            Recurring drills
          </h3>
          <div className="flex flex-wrap gap-2">
            {recurringClusters.map((cluster) => (
              <RepeatingChip
                key={cluster.tag}
                tag={cluster.tag}
                count={cluster.count}
                size="sm"
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ve gotten the same kind of note three or more times. Prioritize these.
          </p>
        </section>
      ) : null}

      {buckets.map((bucket) => (
        <DrillTagSection
          key={bucket.tag ?? "OTHER"}
          tag={bucket.tag}
          itemCount={bucket.rows.length}
          repeatingCount={bucket.isRepeating ? bucket.repeatingCount : undefined}
          variant="card"
        >
          {bucket.rows.map((row) => (
            <DrillRow
              key={row.id}
              item={toDrillItem(row)}
              projectName={
                showProjectInRows ? row.note.rehearsal.project.title : undefined
              }
            />
          ))}
        </DrillTagSection>
      ))}
    </div>
  );
}

function SingleProjectHeader({
  header,
  count,
}: Readonly<{
  header: NonNullable<DrillViewProps["singleProjectHeader"]>;
  count: number;
}>) {
  return (
    <div
      data-print-hidden
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      <span>
        Showing{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {count}
        </span>{" "}
        {count === 1 ? "note" : "notes"} from{" "}
        <span className="font-semibold text-foreground">
          {header.projectName}
        </span>
        {"."}
      </span>
      <button
        type="button"
        onClick={header.onClearProjectFilter}
        className="font-semibold text-foreground underline outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        See all projects
      </button>
    </div>
  );
}

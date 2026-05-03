"use client";

import { ChevronDown, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { TipSequence, type TipStep } from "@/components/onboarding/tip-sequence";
import {
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  type NoteStatus,
} from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import { AssignedNoteCard } from "./assigned-note-card";
import { QueueSummary } from "./queue-summary";
import {
  DEFAULT_EXPANDED_STATUSES,
  EMPTY_FILTER,
  type AssignedNoteRow,
  type AuthorOption,
  type MyNotesFilter,
  type ProjectOption,
  type TypeCounts,
} from "./types";

const STATUS_FG: Record<NoteStatus, string> = {
  OPEN: "var(--status-open-fg)",
  IN_PROGRESS: "var(--status-progress-fg)",
  ADDRESSED: "var(--status-addressed-fg)",
  RESOLVED: "var(--status-resolved-fg)",
};

const STATUS_BG: Record<NoteStatus, string> = {
  OPEN: "var(--status-open-bg)",
  IN_PROGRESS: "var(--status-progress-bg)",
  ADDRESSED: "var(--status-addressed-bg)",
  RESOLVED: "var(--status-resolved-bg)",
};

const STATUS_BORDER: Record<NoteStatus, string> = {
  OPEN: "var(--status-open-border)",
  IN_PROGRESS: "var(--status-progress-border)",
  ADDRESSED: "var(--status-addressed-border)",
  RESOLVED: "var(--status-resolved-border)",
};

type MyNotesListProps = {
  rows: AssignedNoteRow[];
  tipsDismissed: boolean;
};

const MY_NOTES_TIP_STEPS: TipStep[] = [
  {
    anchorSelector: "[data-onboarding-anchor='my-notes-hero']",
    title: "Your oldest unresolved note",
    body: "Up next is what we surface first — work through it, then tap a status below the body to update it. The change saves immediately.",
  },
  {
    anchorSelector: "[data-onboarding-anchor='my-notes-rail']",
    title: "Filter when you need focus",
    body: "Narrow down by who sent it, what project it belongs to, or text vs. voice. Counts on the left always reflect the filtered queue.",
  },
];

function rowMatchesFilter(row: AssignedNoteRow, filter: MyNotesFilter): boolean {
  if (filter.authorId && row.note.author.id !== filter.authorId) return false;
  if (filter.projectId && row.note.rehearsal.project.id !== filter.projectId) {
    return false;
  }
  if (filter.noteType && row.note.noteType !== filter.noteType) return false;
  return true;
}

function compareCreatedAtDesc(a: AssignedNoteRow, b: AssignedNoteRow): number {
  return new Date(b.note.createdAt).getTime() - new Date(a.note.createdAt).getTime();
}

function compareCreatedAtAsc(a: AssignedNoteRow, b: AssignedNoteRow): number {
  return new Date(a.note.createdAt).getTime() - new Date(b.note.createdAt).getTime();
}

type StatusGroupProps = {
  status: NoteStatus;
  rows: AssignedNoteRow[];
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function StatusGroup({
  status,
  rows,
  expanded,
  onToggle,
  children,
}: Readonly<StatusGroupProps>) {
  const hasRows = rows.length > 0;

  const dotStyle: CSSProperties = {
    backgroundColor: STATUS_FG[status],
    boxShadow: `0 0 0 2px color-mix(in oklch, ${STATUS_FG[status]} 25%, var(--card)), 0 0 0 3px ${STATUS_FG[status]}`,
  };
  const countStyle: CSSProperties = {
    backgroundColor: STATUS_BG[status],
    color: STATUS_FG[status],
    borderColor: STATUS_BORDER[status],
  };

  return (
    <section className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasRows}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center justify-between gap-3 border-b border-border px-3.5 py-2.5 text-left",
          hasRows ? "cursor-pointer" : "cursor-default opacity-50"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={dotStyle}
          />
          <span className="text-sm font-semibold">
            {NOTE_STATUS_LABELS[status]}
          </span>
          <span
            className="rounded-full border px-2 py-px text-[11px] font-semibold tabular-nums"
            style={countStyle}
          >
            {rows.length}
          </span>
        </div>
        {hasRows ? (
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              expanded ? "rotate-0" : "-rotate-90"
            )}
          />
        ) : null}
      </button>

      {expanded && hasRows ? (
        <div className="flex flex-col gap-2.5">{children}</div>
      ) : null}
    </section>
  );
}

export function MyNotesList({
  rows,
  tipsDismissed,
}: Readonly<MyNotesListProps>) {
  const [filter, setFilter] = useState<MyNotesFilter>(EMPTY_FILTER);
  const [expanded, setExpanded] = useState<Record<NoteStatus, boolean>>(
    DEFAULT_EXPANDED_STATUSES
  );

  const toggleStatus = (status: NoteStatus) => {
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  // Filter option lists derived from the full row set, so the rail is stable.
  const { authorOptions, projectOptions, typeCounts } = useMemo(() => {
    const authorMap = new Map<string, AuthorOption>();
    const projectMap = new Map<string, ProjectOption>();
    const types: TypeCounts = { TEXT: 0, VOICE: 0 };

    for (const row of rows) {
      const a = row.note.author;
      const existingAuthor = authorMap.get(a.id);
      if (existingAuthor) {
        existingAuthor.count += 1;
      } else {
        authorMap.set(a.id, {
          id: a.id,
          name: a.name ?? "",
          email: a.email,
          count: 1,
        });
      }

      const p = row.note.rehearsal.project;
      const existingProject = projectMap.get(p.id);
      if (existingProject) {
        existingProject.count += 1;
      } else {
        projectMap.set(p.id, { id: p.id, title: p.title, count: 1 });
      }

      types[row.note.noteType] += 1;
    }

    const sortedAuthors = [...authorMap.values()].sort(
      (a, b) => b.count - a.count || (a.name || a.email).localeCompare(b.name || b.email)
    );
    const sortedProjects = [...projectMap.values()].sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title)
    );

    return {
      authorOptions: sortedAuthors,
      projectOptions: sortedProjects,
      typeCounts: types,
    };
  }, [rows]);

  // Filtered rows, status counts, hero pick, grouped buckets.
  const { filteredRows, statusCounts, heroRow, buckets } = useMemo(() => {
    const filtered = rows.filter((row) => rowMatchesFilter(row, filter));

    const counts: Record<NoteStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      ADDRESSED: 0,
      RESOLVED: 0,
    };
    for (const row of filtered) counts[row.status] += 1;

    // Hero = oldest unresolved (OPEN or IN_PROGRESS) in the filtered set.
    const unresolved = filtered
      .filter((row) => row.status === "OPEN" || row.status === "IN_PROGRESS")
      .sort(compareCreatedAtAsc);
    const hero = unresolved[0] ?? null;

    const grouped: Record<NoteStatus, AssignedNoteRow[]> = {
      OPEN: [],
      IN_PROGRESS: [],
      ADDRESSED: [],
      RESOLVED: [],
    };
    for (const row of filtered) {
      if (row.id === hero?.id) continue;
      grouped[row.status].push(row);
    }
    for (const status of NOTE_STATUSES) {
      grouped[status].sort(compareCreatedAtDesc);
    }

    return {
      filteredRows: filtered,
      statusCounts: counts,
      heroRow: hero,
      buckets: grouped,
    };
  }, [rows, filter]);

  const isFilterActive =
    filter.authorId !== null || filter.projectId !== null || filter.noteType !== null;

  return (
    <>
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Left rail */}
      <aside
        data-onboarding-anchor="my-notes-rail"
        className="lg:sticky lg:top-4 lg:self-start"
      >
        <QueueSummary
          statusCounts={statusCounts}
          authorOptions={authorOptions}
          projectOptions={projectOptions}
          typeCounts={typeCounts}
          filter={filter}
          onFilterChange={setFilter}
        />
      </aside>

      {/* Right column: queue */}
      <div className="flex min-w-0 flex-col gap-7">
        {filteredRows.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "You don't have any notes assigned to you yet. When an instructor assigns you feedback, it will show up here."
              : "No notes match this filter."}
            {isFilterActive && rows.length > 0 ? (
              <button
                type="button"
                onClick={() => setFilter(EMPTY_FILTER)}
                className="ml-2 text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Clear filter
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Hero "Up next" */}
            {heroRow ? (
              <section
                data-onboarding-anchor="my-notes-hero"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-background">
                    <Zap aria-hidden className="size-3" /> Up next
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Oldest unresolved note
                  </span>
                </div>
                <AssignedNoteCard row={heroRow} hero />
              </section>
            ) : null}

            {/* Status groups */}
            {NOTE_STATUSES.map((status) => (
              <StatusGroup
                key={status}
                status={status}
                rows={buckets[status]}
                expanded={expanded[status]}
                onToggle={() => toggleStatus(status)}
              >
                {buckets[status].map((row) => (
                  <AssignedNoteCard key={row.id} row={row} />
                ))}
              </StatusGroup>
            ))}
          </>
        )}
      </div>
    </div>

    <TipSequence
      groupKey="myNotes"
      steps={MY_NOTES_TIP_STEPS}
      initiallyDismissed={tipsDismissed}
      // Tour relies on the hero card and rail. If the inbox is empty, the
      // hero won't render — skip the tour entirely so we don't anchor onto
      // the empty-state card.
      enabled={rows.length > 0}
    />
    </>
  );
}

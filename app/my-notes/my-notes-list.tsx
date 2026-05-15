"use client";

import { ChevronDown, Inbox, ListChecks, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { ThreadExpansionProvider } from "@/components/notes/thread-expansion-context";
import { TipSequence, type TipStep } from "@/components/onboarding/tip-sequence";
import {
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  type NoteStatus,
} from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import { AssignedNoteCard } from "./assigned-note-card";
import { DrillView } from "./drill-view";
import { QueueSummary } from "./queue-summary";
import {
  DEFAULT_EXPANDED_STATUSES,
  EMPTY_FILTER,
  type AssignedNoteRow,
  type AuthorOption,
  type MyNotesFilter,
  type ProjectOption,
  type TagOption,
  type TypeCounts,
} from "./types";

type ViewMode = "inbox" | "drill";

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
  viewerId: string;
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
  if (filter.tag && row.note.tag !== filter.tag) return false;
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
  viewerId,
}: Readonly<MyNotesListProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewMode: ViewMode = searchParams.get("view") === "drill" ? "drill" : "inbox";

  // Active projects = projects where this user has at least one open or
  // in-progress note. Used (a) to decide whether each drill row should
  // show its project name, and (b) to auto-default the project filter
  // when the user enters drill mode with notes spread across 2+ projects.
  const activeProjects = useMemo(() => {
    const counts = new Map<
      string,
      { id: string; title: string; openCount: number }
    >();
    for (const row of rows) {
      if (row.status !== "OPEN" && row.status !== "IN_PROGRESS") continue;
      const proj = row.note.rehearsal.project;
      const existing = counts.get(proj.id);
      if (existing) {
        existing.openCount += 1;
      } else {
        counts.set(proj.id, { id: proj.id, title: proj.title, openCount: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.openCount - a.openCount);
  }, [rows]);

  // Lazy-init the filter so a deep-link to ?view=drill on a user with
  // notes in 2+ projects lands on the busiest project automatically.
  const [filter, setFilter] = useState<MyNotesFilter>(() => {
    if (viewMode === "drill" && activeProjects.length >= 2) {
      return { ...EMPTY_FILTER, projectId: activeProjects[0].id };
    }
    return EMPTY_FILTER;
  });
  const [expanded, setExpanded] = useState<Record<NoteStatus, boolean>>(
    DEFAULT_EXPANDED_STATUSES
  );

  // Tracks whether we already auto-defaulted the project filter once this
  // session. Stops the click-toggle handler from re-applying the default
  // after the user has explicitly cleared via "See all projects". The ref
  // is written only in effects and event handlers, never read during
  // render, so it stays compatible with the React Compiler rules.
  const hasAutoDefaultedRef = useRef(false);
  useEffect(() => {
    // Mount-only: if the lazy initializer applied an auto-default (the
    // deep-link case), mark the ref so the toggle doesn't try to default
    // a second time.
    if (filter.projectId !== null && viewMode === "drill" && activeProjects.length >= 2) {
      hasAutoDefaultedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = (status: NoteStatus) => {
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const setViewMode = (next: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "drill") {
      params.set("view", "drill");
      // Click-to-drill auto-default fires only once per session. After
      // the user clears the filter via "See all projects" (or the rail),
      // re-entering drill keeps their explicit choice.
      if (
        !hasAutoDefaultedRef.current &&
        filter.projectId === null &&
        activeProjects.length >= 2
      ) {
        hasAutoDefaultedRef.current = true;
        setFilter((prev) => ({ ...prev, projectId: activeProjects[0].id }));
      }
    } else {
      params.delete("view");
    }
    const query = params.toString();
    router.replace(query ? `/my-notes?${query}` : "/my-notes");
  };

  // Filter option lists derived from the full row set, so the rail is stable.
  const { authorOptions, projectOptions, tagOptions, typeCounts } = useMemo(() => {
    const authorMap = new Map<string, AuthorOption>();
    const projectMap = new Map<string, ProjectOption>();
    const tagCounts = new Map<TagOption["tag"], number>();
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

      if (row.note.tag) {
        tagCounts.set(row.note.tag, (tagCounts.get(row.note.tag) ?? 0) + 1);
      }

      types[row.note.noteType] += 1;
    }

    const sortedAuthors = [...authorMap.values()].sort(
      (a, b) => b.count - a.count || (a.name || a.email).localeCompare(b.name || b.email)
    );
    const sortedProjects = [...projectMap.values()].sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title)
    );
    const sortedTags: TagOption[] = [...tagCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    return {
      authorOptions: sortedAuthors,
      projectOptions: sortedProjects,
      tagOptions: sortedTags,
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
    filter.authorId !== null ||
    filter.projectId !== null ||
    filter.noteType !== null ||
    filter.tag !== null;

  const isDrillMode = viewMode === "drill";

  // When the project filter narrows the drill view down to one project
  // but the user has open notes in 2+, surface a header so they know
  // they're seeing a subset and can expand. Clearing here also marks the
  // session as auto-defaulted so the toggle won't re-default on re-entry.
  const drillSingleProjectHeader = useMemo(() => {
    if (!filter.projectId) return null;
    if (activeProjects.length < 2) return null;
    const project = activeProjects.find((p) => p.id === filter.projectId);
    if (!project) return null;
    return {
      projectName: project.title,
      onClearProjectFilter: () => {
        hasAutoDefaultedRef.current = true;
        setFilter((prev) => ({ ...prev, projectId: null }));
      },
    };
  }, [filter.projectId, activeProjects]);

  // Each drill row shows its project name only when the user has open
  // notes spread across 2+ projects — avoids redundant labels when
  // there's no ambiguity.
  const showProjectInDrillRows = activeProjects.length > 1;

  // Total active (OPEN/IN_PROGRESS) rows across the user's whole inbox,
  // ignoring the current filter. Lets DrillView's empty state distinguish
  // "filtered into a project with nothing" from "globally caught up".
  const totalActiveRowsUnfiltered = useMemo(
    () =>
      rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS")
        .length,
    [rows],
  );

  return (
    <ThreadExpansionProvider>
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
      <div data-print-hidden className="flex justify-end">
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {isDrillMode ? (
        <DrillView
          rows={filteredRows}
          showProjectInRows={showProjectInDrillRows}
          singleProjectHeader={drillSingleProjectHeader}
          totalActiveRowsUnfiltered={totalActiveRowsUnfiltered}
        />
      ) : (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Left rail */}
      <aside
        data-onboarding-anchor="my-notes-rail"
        className="lg:sticky lg:top-4 lg:self-start"
      >
        <QueueSummary
          statusCounts={statusCounts}
          authorOptions={authorOptions}
          projectOptions={projectOptions}
          tagOptions={tagOptions}
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
                <AssignedNoteCard row={heroRow} viewerId={viewerId} hero />
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
                  <AssignedNoteCard key={row.id} row={row} viewerId={viewerId} />
                ))}
              </StatusGroup>
            ))}
          </>
        )}
      </div>
    </div>
      )}
    </div>

    <TipSequence
      groupKey="myNotes"
      steps={MY_NOTES_TIP_STEPS}
      initiallyDismissed={tipsDismissed}
      // Tour relies on the hero card and rail. If the inbox is empty, the
      // hero won't render — skip the tour entirely so we don't anchor onto
      // the empty-state card. Also skip when in drill mode (anchors absent).
      enabled={rows.length > 0 && viewMode === "inbox"}
    />
    </ThreadExpansionProvider>
  );
}

type ViewToggleProps = {
  viewMode: ViewMode;
  onChange: (next: ViewMode) => void;
};

function ViewToggle({ viewMode, onChange }: Readonly<ViewToggleProps>) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex gap-0.5 rounded-md border border-border bg-muted p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "inbox"}
        onClick={() => onChange("inbox")}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-2.5 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          viewMode === "inbox"
            ? "bg-card font-semibold text-foreground shadow-sm"
            : "font-medium text-muted-foreground hover:text-foreground"
        )}
      >
        <Inbox aria-hidden className="size-3.5" />
        Inbox
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "drill"}
        onClick={() => onChange("drill")}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] px-2.5 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          viewMode === "drill"
            ? "bg-card font-semibold text-foreground shadow-sm"
            : "font-medium text-muted-foreground hover:text-foreground"
        )}
      >
        <ListChecks aria-hidden className="size-3.5" />
        Drill view
      </button>
    </div>
  );
}

"use client";

import { ChevronDown, FileText, Mic, SlidersHorizontal, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import {
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  type NoteStatus,
} from "@/lib/notes/statuses";
import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

import type {
  AuthorOption,
  MyNotesFilter,
  ProjectOption,
  TagOption,
  TypeCounts,
} from "./types";

const STATUS_COLOR: Record<NoteStatus, string> = {
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

type QueueSummaryProps = {
  /** Status breakdown for the currently filtered queue. */
  statusCounts: Record<NoteStatus, number>;
  /** Total count options for each filter category (unfiltered). */
  authorOptions: AuthorOption[];
  projectOptions: ProjectOption[];
  tagOptions: TagOption[];
  typeCounts: TypeCounts;
  filter: MyNotesFilter;
  onFilterChange: (next: MyNotesFilter) => void;
};

function RailHeader({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

export function QueueSummary({
  statusCounts,
  authorOptions,
  projectOptions,
  tagOptions,
  typeCounts,
  filter,
  onFilterChange,
}: Readonly<QueueSummaryProps>) {
  const todo = statusCounts.OPEN + statusCounts.IN_PROGRESS;

  const activeFilterCount =
    (filter.authorId ? 1 : 0) +
    (filter.projectId ? 1 : 0) +
    (filter.noteType ? 1 : 0) +
    (filter.tag ? 1 : 0);

  // Mobile-only disclosure: the From / Project / Type sections collapse so
  // the user reaches "Up next" sooner. On lg+ this state is irrelevant —
  // the wrapper has `lg:flex` which overrides any `hidden`. Open by default
  // if a filter is already active (e.g. user navigated back to the page).
  const [filtersOpen, setFiltersOpen] = useState(() => activeFilterCount > 0);

  const toggleAuthor = (id: string) =>
    onFilterChange({ ...filter, authorId: filter.authorId === id ? null : id });
  const toggleProject = (id: string) =>
    onFilterChange({
      ...filter,
      projectId: filter.projectId === id ? null : id,
    });
  const toggleType = (kind: "TEXT" | "VOICE") =>
    onFilterChange({
      ...filter,
      noteType: filter.noteType === kind ? null : kind,
    });
  const toggleTag = (tag: NoteTag) =>
    onFilterChange({ ...filter, tag: filter.tag === tag ? null : tag });

  return (
    <div className="flex flex-col gap-6">
      {/* On your plate */}
      <section className="flex flex-col gap-1.5">
        <RailHeader>On your plate</RailHeader>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
            {todo}
          </span>
          <span className="text-sm text-muted-foreground">
            {todo === 1 ? "note to address" : "notes to address"}
          </span>
        </div>
      </section>

      {/* Status breakdown */}
      <section className="flex flex-col gap-1">
        {NOTE_STATUSES.map((status) => {
          const count = statusCounts[status];
          const emphasized =
            count > 0 && (status === "OPEN" || status === "IN_PROGRESS");
          const style: CSSProperties = emphasized
            ? {
                backgroundColor: STATUS_BG[status],
                borderColor: STATUS_BORDER[status],
              }
            : { borderColor: "transparent" };

          return (
            <div
              key={status}
              data-status={status}
              className="flex items-center gap-2.5 rounded-md border px-2.5 py-2"
              style={style}
            >
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[status] }}
              />
              <span className="text-xs font-medium">
                {NOTE_STATUS_LABELS[status]}
              </span>
              <span
                className={cn(
                  "ml-auto text-sm font-semibold tabular-nums",
                  count === 0 && "text-muted-foreground"
                )}
              >
                {count}
              </span>
            </div>
          );
        })}
      </section>

      {/* Mobile-only disclosure trigger. Hidden on lg+ so the desktop rail
          renders all sections inline as before. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        aria-expanded={filtersOpen}
        aria-controls="my-notes-rail-filters"
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring lg:hidden",
          filtersOpen && "bg-muted/40"
        )}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden className="size-3.5" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1.5 text-[10.5px] font-semibold tabular-nums text-background">
              {activeFilterCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            filtersOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      <div
        id="my-notes-rail-filters"
        className={cn(
          "flex-col gap-6 lg:flex",
          filtersOpen ? "flex" : "hidden"
        )}
      >
      {/* From */}
      {authorOptions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <RailHeader>From</RailHeader>
          <div className="flex flex-col gap-0.5">
            {authorOptions.map((author) => {
              const active = filter.authorId === author.id;
              return (
                <button
                  key={author.id}
                  type="button"
                  onClick={() => toggleAuthor(author.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-muted"
                      : "hover:bg-muted/60"
                  )}
                >
                  <AvatarInitials
                    name={author.name}
                    fallback={author.email}
                    toneSeed={author.id}
                    size={22}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      active ? "font-semibold" : "font-medium"
                    )}
                  >
                    {author.name || author.email}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {author.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Tag */}
      {tagOptions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <RailHeader>Tag</RailHeader>
          <div className="flex flex-wrap gap-1">
            {tagOptions.map((option) => {
              const active = filter.tag === option.tag;
              return (
                <button
                  key={option.tag}
                  type="button"
                  onClick={() => toggleTag(option.tag)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:bg-muted/60"
                  )}
                >
                  <TagIcon aria-hidden className="size-2.5" />
                  {NOTE_TAG_LABELS[option.tag]}
                  <span
                    className={cn(
                      "tabular-nums",
                      active ? "opacity-80" : "text-muted-foreground"
                    )}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Project */}
      {projectOptions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <RailHeader>Project</RailHeader>
          <div className="flex flex-col gap-0.5">
            {projectOptions.map((project) => {
              const active = filter.projectId === project.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    aria-hidden
                    className="inline-block size-1.5 shrink-0 rounded-sm bg-primary"
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      active ? "font-semibold" : "font-medium"
                    )}
                  >
                    {project.title}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {project.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Type */}
      <section className="flex flex-col gap-2">
        <RailHeader>Type</RailHeader>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => toggleType("TEXT")}
            aria-pressed={filter.noteType === "TEXT"}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              filter.noteType === "TEXT"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:bg-muted/60"
            )}
          >
            <FileText aria-hidden className="size-3" /> Text
            <span
              className={cn(
                "tabular-nums",
                filter.noteType === "TEXT"
                  ? "opacity-80"
                  : "text-muted-foreground"
              )}
            >
              {typeCounts.TEXT}
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleType("VOICE")}
            aria-pressed={filter.noteType === "VOICE"}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              filter.noteType === "VOICE"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:bg-muted/60"
            )}
          >
            <Mic
              aria-hidden
              className="size-3"
              style={
                filter.noteType === "VOICE"
                  ? undefined
                  : { color: "var(--note-voice-accent)" }
              }
            />{" "}
            Voice
            <span
              className={cn(
                "tabular-nums",
                filter.noteType === "VOICE"
                  ? "opacity-80"
                  : "text-muted-foreground"
              )}
            >
              {typeCounts.VOICE}
            </span>
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}

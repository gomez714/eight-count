"use client";

import { Clock, Tag as TagIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

import type { AuthoredNoteFilter, AuthoredNoteSort } from "./types";

type FilterCounts = Record<AuthoredNoteFilter, number>;

export type TagFilterOption = {
  tag: NoteTag;
  count: number;
};

type FilterSortBarProps = {
  filter: AuthoredNoteFilter;
  onFilterChange: (next: AuthoredNoteFilter) => void;
  sort: AuthoredNoteSort;
  onSortChange: (next: AuthoredNoteSort) => void;
  counts: FilterCounts;
  tagOptions: TagFilterOption[];
  tagFilter: NoteTag | null;
  onTagFilterChange: (next: NoteTag | null) => void;
};

const FILTERS: ReadonlyArray<{ key: AuthoredNoteFilter; label: string }> = [
  { key: "OUTSTANDING", label: "Outstanding" },
  { key: "STALLED", label: "Stalled" },
  { key: "COMPLETE", label: "Complete" },
  { key: "UNASSIGNED", label: "Unassigned" },
  { key: "ALL", label: "All" },
];

const SORTS: ReadonlyArray<{ key: AuthoredNoteSort; label: string }> = [
  { key: "STALLED_FIRST", label: "Stalled first" },
  { key: "RECENT", label: "Most recent" },
  { key: "OLDEST", label: "Oldest" },
];

export function FilterSortBar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  counts,
  tagOptions,
  tagFilter,
  onTagFilterChange,
}: Readonly<FilterSortBarProps>) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3">
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Filter notes" className="flex flex-wrap gap-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key];
          const isStalledChip = f.key === "STALLED" && count > 0;

          const buttonStyle: CSSProperties | undefined =
            !active && isStalledChip
              ? {
                  backgroundColor: "var(--status-progress-bg)",
                  color: "var(--status-progress-fg)",
                  borderColor: "var(--status-progress-border)",
                }
              : undefined;

          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-foreground bg-foreground font-semibold text-background"
                  : "border-border bg-card font-medium hover:bg-muted/60"
              )}
              style={buttonStyle}
            >
              {f.key === "STALLED" ? <Clock aria-hidden className="size-3" /> : null}
              {f.label}
              <span
                className={cn(
                  "inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums",
                  active
                    ? "bg-background/20 text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2 max-md:order-3 max-md:ml-0">
        <span className="text-[11px] text-muted-foreground">Sort</span>
        <div
          role="radiogroup"
          aria-label="Sort notes"
          className="inline-flex gap-0.5 rounded-md border border-border bg-muted p-0.5"
        >
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSortChange(s.key)}
                className={cn(
                  "inline-flex h-7 items-center rounded-[calc(var(--radius-md)-3px)] px-2.5 text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-card font-semibold text-foreground shadow-sm"
                    : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {tagOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-2.5">
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <TagIcon aria-hidden className="size-3" />
            Tags
          </span>
          <button
            type="button"
            onClick={() => onTagFilterChange(null)}
            aria-pressed={tagFilter === null}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              tagFilter === null
                ? "border-foreground bg-foreground font-semibold text-background"
                : "border-border bg-card hover:bg-muted/60"
            )}
          >
            All
          </button>
          {tagOptions.map((option) => {
            const active = tagFilter === option.tag;
            return (
              <button
                key={option.tag}
                type="button"
                onClick={() => onTagFilterChange(active ? null : option.tag)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-foreground bg-foreground font-semibold text-background"
                    : "border-border bg-card font-medium hover:bg-muted/60"
                )}
              >
                {NOTE_TAG_LABELS[option.tag]}
                <span
                  className={cn(
                    "inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums",
                    active
                      ? "bg-background/20 text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

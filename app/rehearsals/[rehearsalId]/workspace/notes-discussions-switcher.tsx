"use client";

import { MessagesSquare, NotebookPen } from "lucide-react";

import { cn } from "@/lib/utils";

export type ListTab = "notes" | "discussions";

type NotesDiscussionsSwitcherProps = {
  active: ListTab;
  onChange: (next: ListTab) => void;
  noteCount: number;
  discussionCount: number;
};

/**
 * Two-button segmented switcher above the workspace's list/composer
 * column. Mirrors the `Inbox / Drill view` pattern from `/my-notes`.
 *
 * The active palette differs by tab so the switcher visually previews
 * what the user is about to land on:
 *   - Notes  → teal `--primary` (matches the existing notes accent)
 *   - Discussions → indigo `--discussion-accent` (matches the discussion family)
 *
 * Counts are shown inside each pill; they update immediately on
 * create / delete via the workspace's `router.refresh()` after mutation.
 */
export function NotesDiscussionsSwitcher({
  active,
  onChange,
  noteCount,
  discussionCount,
}: Readonly<NotesDiscussionsSwitcherProps>) {
  return (
    <div
      role="tablist"
      aria-label="Notes or discussions"
      className="inline-flex w-full gap-1 rounded-md border bg-card p-0.5"
    >
      <Tab
        active={active === "notes"}
        onClick={() => onChange("notes")}
        icon={<NotebookPen className="size-3.5" />}
        label="Notes"
        count={noteCount}
        accentBg="var(--primary)"
      />
      <Tab
        active={active === "discussions"}
        onClick={() => onChange("discussions")}
        icon={<MessagesSquare className="size-3.5" />}
        label="Discussions"
        count={discussionCount}
        accentBg="var(--discussion-accent)"
      />
    </div>
  );
}

type TabProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  accentBg: string;
};

function Tab({
  active,
  onClick,
  icon,
  label,
  count,
  accentBg,
}: Readonly<TabProps>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors",
        active
          ? "text-background"
          : "text-muted-foreground hover:text-foreground"
      )}
      style={active ? { backgroundColor: accentBg } : undefined}
    >
      {icon}
      <span>{label}</span>
      {count > 0 ? (
        <span
          className={cn(
            "tabular-nums text-xs",
            active ? "opacity-90" : "text-muted-foreground/80"
          )}
        >
          ({count})
        </span>
      ) : null}
    </button>
  );
}

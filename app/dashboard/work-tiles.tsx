import { ChevronRight, Inbox, Send } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { MyNotesMetrics, NotesByMeMetrics } from "./types";

type WorkTilesProps = {
  myNotes: MyNotesMetrics;
  notesByMe: NotesByMeMetrics;
  /** Whether to render the "Notes by me" tile. Hidden for users who can't author notes. */
  showNotesByMe: boolean;
};

export function WorkTiles({
  myNotes,
  notesByMe,
  showNotesByMe,
}: Readonly<WorkTilesProps>) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        showNotesByMe ? "grid-cols-2" : "grid-cols-1"
      )}
    >
      <Tile
        href="/my-notes"
        icon={<Inbox className="size-4" />}
        eyebrow="My notes"
        primary={{
          value: myNotes.onPlate,
          label: "on your plate",
        }}
        emptyLabel={
          myNotes.total === 0
            ? "Nothing assigned yet"
            : "All caught up"
        }
      />

      {showNotesByMe ? (
        <Tile
          href="/notes-by-me"
          icon={<Send className="size-4" />}
          eyebrow="Notes by me"
          primary={{
            value: notesByMe.total,
            label: notesByMe.total === 1 ? "sent" : "sent",
          }}
          accent={
            notesByMe.stalled > 0
              ? {
                  value: notesByMe.stalled,
                  label: "stalled",
                }
              : null
          }
          emptyLabel={
            notesByMe.total === 0 ? "You haven't sent any yet" : null
          }
        />
      ) : null}
    </div>
  );
}

type TileMetric = {
  value: number;
  label: string;
};

type TileProps = {
  href: string;
  icon: ReactNode;
  eyebrow: string;
  primary: TileMetric;
  accent?: TileMetric | null;
  /** Used when `primary.value` is 0 to soften the "0" with a friendlier line. */
  emptyLabel?: string | null;
};

function Tile({
  href,
  icon,
  eyebrow,
  primary,
  accent,
  emptyLabel,
}: Readonly<TileProps>) {
  const isEmpty = primary.value === 0;
  const accentTinted = accent && accent.value > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-card p-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
        accentTinted && "border-(--status-progress-border)"
      )}
      style={
        accentTinted
          ? {
              backgroundColor:
                "color-mix(in oklch, var(--status-progress-bg) 35%, var(--card))",
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span aria-hidden className="inline-flex">
            {icon}
          </span>
          {eyebrow}
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground"
        />
      </div>

      {isEmpty && emptyLabel ? (
        <div className="text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums sm:text-3xl">
            {primary.value}
          </span>
          <span className="text-xs text-muted-foreground sm:text-sm">
            {primary.label}
          </span>
          {accentTinted ? (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={{
                backgroundColor: "var(--status-progress-bg)",
                color: "var(--status-progress-fg)",
              }}
            >
              {accent.value} {accent.label}
            </span>
          ) : null}
        </div>
      )}
    </Link>
  );
}

"use client";

import type { CSSProperties } from "react";

import {
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  type NoteStatus,
} from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<NoteStatus, string> = {
  OPEN: "var(--status-open-fg)",
  IN_PROGRESS: "var(--status-progress-fg)",
  ADDRESSED: "var(--status-addressed-fg)",
  RESOLVED: "var(--status-resolved-fg)",
};

// Shorter alias used on narrow viewports so the 4-button control fits inside
// the card without clipping. "In progress" is the only label long enough to
// matter; the others stay identical via NOTE_STATUS_LABELS.
const NARROW_STATUS_LABEL: Record<NoteStatus, string> = {
  OPEN: NOTE_STATUS_LABELS.OPEN,
  IN_PROGRESS: "Working",
  ADDRESSED: NOTE_STATUS_LABELS.ADDRESSED,
  RESOLVED: NOTE_STATUS_LABELS.RESOLVED,
};

type StatusSegmentedProps = {
  value: NoteStatus;
  onChange: (next: NoteStatus) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
};

export function StatusSegmented({
  value,
  onChange,
  disabled = false,
  size = "md",
  className,
  ariaLabel = "Update note status",
}: Readonly<StatusSegmentedProps>) {
  const padding = size === "sm" ? "px-2.5 h-7 text-[11.5px]" : "px-3 h-8 text-xs";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        // Below `sm`: full-width 2×2 grid so the control can't outgrow the card.
        // At `sm+`: revert to the single-row inline layout used today.
        "grid w-full grid-cols-2 gap-0.5 rounded-md border border-border bg-muted p-0.5",
        "sm:inline-flex sm:w-auto sm:items-center",
        className
      )}
    >
      {NOTE_STATUSES.map((status) => {
        const isActive = status === value;
        const color = STATUS_COLOR[status];
        const buttonStyle: CSSProperties | undefined = isActive
          ? { color, boxShadow: "0 1px 2px oklch(0 0 0 / 0.06)" }
          : undefined;
        const dotStyle: CSSProperties = {
          backgroundColor: isActive
            ? color
            : "color-mix(in oklch, var(--muted-foreground) 40%, transparent)",
        };

        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (!isActive) onChange(status);
            }}
            className={cn(
              // `justify-center` only matters on the mobile grid; the desktop
              // inline layout is unaffected because each button is content-sized.
              "inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-3px)] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              padding,
              isActive
                ? "bg-card font-semibold"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60"
            )}
            style={buttonStyle}
          >
            <span
              aria-hidden
              className="inline-block size-[7px] shrink-0 rounded-full"
              style={dotStyle}
            />
            <span className="sm:hidden">{NARROW_STATUS_LABEL[status]}</span>
            <span className="hidden sm:inline">
              {NOTE_STATUS_LABELS[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { type CSSProperties } from "react";

import {
  NOTE_STATUS_LABELS,
  type NoteStatus,
} from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

const STATUS_TOKENS: Record<
  NoteStatus,
  { bg: string; fg: string; border: string }
> = {
  OPEN: {
    bg: "var(--status-open-bg)",
    fg: "var(--status-open-fg)",
    border: "var(--status-open-border)",
  },
  IN_PROGRESS: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
  },
  ADDRESSED: {
    bg: "var(--status-addressed-bg)",
    fg: "var(--status-addressed-fg)",
    border: "var(--status-addressed-border)",
  },
  RESOLVED: {
    bg: "var(--status-resolved-bg)",
    fg: "var(--status-resolved-fg)",
    border: "var(--status-resolved-border)",
  },
};

type StatusDotProps = {
  status: NoteStatus;
  className?: string;
};

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      aria-hidden
      data-status={status}
      className={cn(
        "inline-block size-[7px] shrink-0 rounded-full",
        className
      )}
      style={{ backgroundColor: STATUS_TOKENS[status].fg }}
    />
  );
}

type StatusChipProps = {
  status: NoteStatus;
  label?: string;
};

export function StatusChip({ status, label }: StatusChipProps) {
  const tokens = STATUS_TOKENS[status];
  const style: CSSProperties = {
    backgroundColor: tokens.bg,
    color: tokens.fg,
    borderColor: tokens.border,
  };

  return (
    <span
      data-status={status}
      title={label}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
      style={style}
    >
      {label ? (
        <span className="min-w-0 truncate font-medium">{label}</span>
      ) : null}
      <StatusDot status={status} />
      <span className="shrink-0 font-semibold">{NOTE_STATUS_LABELS[status]}</span>
    </span>
  );
}

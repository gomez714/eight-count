import type { FeedbackStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
  WONT_DO: "Won't do",
  DUPLICATE: "Duplicate",
};

const STATUS_TOKENS: Record<
  FeedbackStatus,
  { bg: string; fg: string; border: string }
> = {
  NEW: {
    bg: "color-mix(in oklch, var(--primary) 14%, transparent)",
    fg: "var(--primary)",
    border: "color-mix(in oklch, var(--primary) 45%, transparent)",
  },
  TRIAGED: {
    bg: "var(--muted)",
    fg: "var(--muted-foreground)",
    border: "var(--border)",
  },
  IN_PROGRESS: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
  },
  SHIPPED: {
    bg: "var(--status-addressed-bg)",
    fg: "var(--status-addressed-fg)",
    border: "var(--status-addressed-border)",
  },
  WONT_DO: {
    bg: "var(--muted)",
    fg: "var(--muted-foreground)",
    border: "var(--border)",
  },
  DUPLICATE: {
    bg: "var(--muted)",
    fg: "var(--muted-foreground)",
    border: "var(--border)",
  },
};

type FeedbackStatusChipProps = {
  status: FeedbackStatus;
  className?: string;
};

export function FeedbackStatusChip({
  status,
  className,
}: Readonly<FeedbackStatusChipProps>) {
  const tokens = STATUS_TOKENS[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: tokens.bg,
        color: tokens.fg,
        borderColor: tokens.border,
      }}
    >
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  );
}

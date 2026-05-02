import { Check, ChevronRight, Clock, FileText, Mic, Play } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import {
  NoteProgressBar,
  type NoteProgressCounts,
} from "@/components/note-progress-bar";
import { cn } from "@/lib/utils";

type Contributor = {
  id: string;
  name: string | null;
  email: string;
};

export type RehearsalRowData = {
  id: string;
  title: string;
  rehearsalDate: Date;
  hasVideo: boolean;
  videoDurationMs: number | null;
  noteCounts: {
    total: number;
    voice: number;
  };
  assignmentCounts: NoteProgressCounts;
  contributors: Contributor[];
  stalledCount: number;
  isCurrent: boolean;
};

type RehearsalRowProps = {
  rehearsal: RehearsalRowData;
};

function formatDuration(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (Math.abs(diffSec) < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60)
    return diffMin >= 0 ? `${diffMin}m ago` : `in ${-diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24)
    return diffHr >= 0 ? `${diffHr}h ago` : `in ${-diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7)
    return diffDay >= 0 ? `${diffDay}d ago` : `in ${-diffDay}d`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function CurrentPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
      <span aria-hidden className="inline-block size-1 rounded-full bg-current" />
      Current
    </span>
  );
}

function ContributorStack({ people }: Readonly<{ people: Contributor[] }>) {
  if (people.length === 0) return null;
  const visible = people.slice(0, 3);
  const overflow = people.length - visible.length;
  const size = 18;
  return (
    <span className="inline-flex items-center">
      {visible.map((p, i) => (
        <span
          key={p.id}
          className="inline-flex rounded-full ring-2 ring-card"
          style={i === 0 ? undefined : { marginLeft: -5 }}
        >
          <AvatarInitials
            name={p.name}
            fallback={p.email}
            toneSeed={p.id}
            size={size}
          />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size, marginLeft: -5 }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export function RehearsalRow({ rehearsal }: Readonly<RehearsalRowProps>) {
  const {
    id,
    title,
    rehearsalDate,
    hasVideo,
    videoDurationMs,
    noteCounts,
    assignmentCounts,
    contributors,
    stalledCount,
    isCurrent,
  } = rehearsal;

  const totalAssignments =
    assignmentCounts.OPEN +
    assignmentCounts.IN_PROGRESS +
    assignmentCounts.ADDRESSED +
    assignmentCounts.RESOLVED;
  const closed = assignmentCounts.ADDRESSED + assignmentCounts.RESOLVED;
  const isComplete = totalAssignments > 0 && closed === totalAssignments;
  const pct =
    totalAssignments === 0 ? 0 : Math.round((closed / totalAssignments) * 100);

  const stripeStyle: CSSProperties = {
    backgroundColor: isCurrent ? "var(--primary)" : "var(--border)",
  };

  const monthLabel = rehearsalDate.toLocaleString("en-US", { month: "short" });
  const dayLabel = rehearsalDate.getDate();
  const timeLabel = rehearsalDate.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const duration = formatDuration(videoDurationMs);

  return (
    <Link
      href={`/rehearsals/${id}`}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border bg-card p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
        "md:grid md:grid-cols-[80px_minmax(0,1fr)_220px_16px] md:items-center md:gap-4 md:p-4",
        isCurrent && "border-primary/35 shadow-sm"
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-[3px] rounded-r"
        style={stripeStyle}
      />

      {/* Date plate */}
      <div className="flex items-baseline gap-3 pl-3 md:flex-col md:items-start md:gap-1 md:pl-4">
        <span
          className={cn(
            "text-[10.5px] font-semibold uppercase tracking-wider",
            isCurrent ? "text-primary" : "text-muted-foreground"
          )}
        >
          {monthLabel}
        </span>
        <span className="text-2xl font-semibold leading-none tracking-tight tabular-nums">
          {dayLabel}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {timeLabel}
        </span>
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-col gap-1.5 md:gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isCurrent ? <CurrentPill /> : null}
          <h3 className="truncate text-[14.5px] font-semibold leading-tight">
            {title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {hasVideo ? (
            <span className="inline-flex items-center gap-1">
              <Play aria-hidden className="size-3" />
              {duration ?? "Video"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 italic">
              No video yet
            </span>
          )}
          <span aria-hidden className="h-2.5 w-px bg-border" />
          <span className="inline-flex items-center gap-1">
            <FileText aria-hidden className="size-3" />
            {noteCounts.total} {noteCounts.total === 1 ? "note" : "notes"}
            {noteCounts.voice > 0 ? (
              <span
                className="ml-0.5 inline-flex items-center gap-0.5 font-semibold"
                style={{ color: "var(--note-voice-accent)" }}
              >
                <Mic aria-hidden className="size-3" />
                {noteCounts.voice}
              </span>
            ) : null}
          </span>
          {contributors.length > 0 ? (
            <>
              <span aria-hidden className="h-2.5 w-px bg-border" />
              <span className="inline-flex items-center gap-1.5">
                <ContributorStack people={contributors} />
                <span>{formatRelative(rehearsalDate)}</span>
              </span>
            </>
          ) : (
            <>
              <span aria-hidden className="h-2.5 w-px bg-border" />
              <span>{formatRelative(rehearsalDate)}</span>
            </>
          )}
          {stalledCount > 0 ? (
            <>
              <span aria-hidden className="h-2.5 w-px bg-border" />
              <span
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color: "var(--status-progress-fg)" }}
              >
                <Clock aria-hidden className="size-3" />
                {stalledCount} stalled
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5 md:px-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes resolved
          </span>
          {totalAssignments > 0 ? (
            <span
              className="text-xs font-semibold tabular-nums"
              style={
                isComplete ? { color: "var(--status-resolved-fg)" } : undefined
              }
            >
              {closed}
              <span className="font-medium text-muted-foreground">
                /{totalAssignments}
              </span>
              <span className="ml-1 font-medium text-muted-foreground">
                · {pct}%
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              No notes yet
            </span>
          )}
        </div>
        {totalAssignments > 0 ? (
          <NoteProgressBar counts={assignmentCounts} height={5} />
        ) : (
          <div
            aria-hidden
            className="h-[5px] rounded-full"
            style={{ backgroundColor: "var(--status-open-bg)" }}
          />
        )}
        {isComplete ? (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: "var(--status-resolved-fg)" }}
          >
            <Check aria-hidden className="size-3" /> All notes resolved
          </span>
        ) : totalAssignments > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {assignmentCounts.OPEN} open · {assignmentCounts.IN_PROGRESS}{" "}
            working · {closed} done
          </span>
        ) : null}
      </div>

      <ChevronRight
        aria-hidden
        className="hidden size-4 text-muted-foreground transition-colors group-hover:text-foreground md:inline"
      />
    </Link>
  );
}

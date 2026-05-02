import { ChevronRight, Film, FileText } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ProjectStatus = "ACTIVE" | "ARCHIVED";

export type ProjectRowData = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  rehearsalCount: number;
  openNotesCount: number;
  lastActivity: Date | null;
  createdAt: Date;
};

const STATUS_STYLES: Record<
  ProjectStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  ACTIVE: {
    label: "Active",
    bg: "var(--status-addressed-bg)",
    fg: "var(--status-addressed-fg)",
    border: "var(--status-addressed-border)",
  },
  ARCHIVED: {
    label: "Archived",
    bg: "var(--muted)",
    fg: "var(--muted-foreground)",
    border: "var(--border)",
  },
};

function ProjectStatusPill({ status }: Readonly<{ status: ProjectStatus }>) {
  const tone = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: tone.bg,
        color: tone.fg,
        borderColor: tone.border,
      }}
    >
      <span
        aria-hidden
        className="inline-block size-1 rounded-full"
        style={{ backgroundColor: tone.fg }}
      />
      {tone.label}
    </span>
  );
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

type ProjectRowProps = {
  project: ProjectRowData;
};

export function ProjectRow({ project }: Readonly<ProjectRowProps>) {
  const isArchived = project.status === "ARCHIVED";
  const lastActivity = project.lastActivity ?? project.createdAt;
  const lastLabel = project.lastActivity
    ? formatRelative(lastActivity)
    : `Created ${formatRelative(project.createdAt)}`;

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring",
        "md:grid md:grid-cols-[minmax(0,1fr)_auto_16px] md:items-center md:gap-4 md:p-4",
        isArchived && "opacity-80"
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[14.5px] font-semibold leading-tight">
            {project.title}
          </h3>
          <ProjectStatusPill status={project.status} />
        </div>
        {project.description ? (
          <p className="line-clamp-1 max-w-2xl text-[12.5px] leading-snug text-muted-foreground">
            {project.description}
          </p>
        ) : (
          <p className="text-[12.5px] italic text-muted-foreground">
            No description yet
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:justify-end md:whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <Film aria-hidden className="size-3" />
          {project.rehearsalCount}{" "}
          {project.rehearsalCount === 1 ? "rehearsal" : "rehearsals"}
        </span>
        {project.openNotesCount > 0 ? (
          <>
            <span aria-hidden className="hidden h-2.5 w-px bg-border md:inline" />
            <span
              className="inline-flex items-center gap-1 font-semibold"
              style={{ color: "var(--status-progress-fg)" }}
            >
              <FileText aria-hidden className="size-3" />
              {project.openNotesCount} open
            </span>
          </>
        ) : null}
        <span aria-hidden className="hidden h-2.5 w-px bg-border md:inline" />
        <span>{lastLabel}</span>
      </div>

      <ChevronRight
        aria-hidden
        className="hidden size-4 text-muted-foreground transition-colors group-hover:text-foreground md:inline"
      />
    </Link>
  );
}

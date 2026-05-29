import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Role = "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  ASSISTANT: "Assistant",
  DANCER: "Dancer",
};

type RehearsalContextBarProps = {
  team: { id: string; name: string };
  project: { id: string; title: string };
  rehearsal: {
    title: string;
    date: Date;
    description: string | null;
  };
  role: Role | null;
  memberCount: number;
  videoFileName: string | null;
  actions?: ReactNode;
};

function RolePill({ role }: { role: Role }) {
  const isStaff = role !== "DANCER";
  return (
    <span
      data-role={role}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-wider uppercase",
        isStaff
          ? "border border-primary/20 bg-primary/10 text-primary"
          : "border border-border bg-card text-muted-foreground"
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

export function RehearsalContextBar({
  team,
  project,
  rehearsal,
  role,
  memberCount,
  videoFileName,
  actions,
}: RehearsalContextBarProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(rehearsal.date);

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-4">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground"
        >
          <Link
            href={`/teams/${team.id}`}
            className="min-w-0 truncate rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {team.name}
          </Link>
          <ChevronRight aria-hidden className="size-3 shrink-0 opacity-60" />
          <Link
            href={`/projects/${project.id}`}
            className="min-w-0 truncate rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {project.title}
          </Link>
          <ChevronRight aria-hidden className="size-3 shrink-0 opacity-60" />
          <span className="min-w-0 truncate font-semibold text-foreground">
            {rehearsal.title}
          </span>
        </nav>

        {/* Title row — stacks on mobile so the title gets the full width;
            side-by-side at sm:+ so actions stay anchored right. */}
        <div className="flex flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:flex-1">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
              {rehearsal.title}
            </h1>
            {role ? <RolePill role={role} /> : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto sm:gap-2">
              {actions}
            </div>
          ) : null}
        </div>

        {/* Filename is noise for navigation on a phone — the workspace
            video card already surfaces it. Drop it below sm:. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{formattedDate}</span>
          <span aria-hidden>·</span>
          <span>
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </span>
          {videoFileName ? (
            <>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="hidden truncate font-mono sm:inline">
                {videoFileName}
              </span>
            </>
          ) : null}
        </div>

        {rehearsal.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
            {rehearsal.description}
          </p>
        ) : null}
      </div>
    </header>
  );
}

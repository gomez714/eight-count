import { ChevronRight, FolderOpen } from "lucide-react";
import Link from "next/link";

import { AvatarInitials } from "@/components/avatar-initials";

import { RoleChip } from "@/app/teams/[teamId]/role-chip";

import type { TeamRowData } from "./types";

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

type TeamRowProps = {
  team: TeamRowData;
};

export function TeamRow({ team }: Readonly<TeamRowProps>) {
  const projectsLabel =
    team.projectCount === 1 ? "1 project" : `${team.projectCount} projects`;

  let activityLabel: string;
  if (team.lastActivityAt) {
    activityLabel = `last active ${formatRelative(team.lastActivityAt)}`;
  } else if (team.projectCount === 0) {
    activityLabel = "no projects yet";
  } else {
    activityLabel = "no rehearsals yet";
  }

  return (
    <Link
      href={`/teams/${team.id}`}
      className="group flex items-center gap-3 rounded-lg border bg-card p-3 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
    >
      <AvatarInitials name={team.name} toneSeed={team.id} size={40} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold sm:text-base">
            {team.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen aria-hidden className="size-3" />
          <span className="tabular-nums">{projectsLabel}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{activityLabel}</span>
        </div>
      </div>

      {team.isPersonal ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Personal
        </span>
      ) : (
        <RoleChip role={team.role} />
      )}

      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground"
      />
    </Link>
  );
}

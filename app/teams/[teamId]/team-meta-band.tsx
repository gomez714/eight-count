import { CalendarDays, ChevronRight, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { ROLE_LABEL, type TeamRole } from "./role-chip";
import { RoleChipPopover } from "./role-chip-popover";

type Team = {
  id: string;
  name: string;
};

type RoleGlance = {
  role: TeamRole;
  count: number;
};

type TeamMetaBandProps = {
  team: Team;
  viewerRole: TeamRole | null;
  memberCount: number;
  projectCount: number;
  roleGlance: RoleGlance[];
  createdAt: Date;
  titleActions?: ReactNode;
  /**
   * Personal-workspace mode: hide member-count chip, role glance strip,
   * and the viewer's role chip; replace the desktop helper line and the
   * mobile counts subtitle with "Personal workspace" framing. Inviting
   * anyone (via the members section) flips this back off — see
   * `inviteTeamMember` in member-actions.ts.
   */
  isPersonal?: boolean;
};

function formatCreated(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

const ROLE_TONE_VAR: Record<TeamRole, string> = {
  ADMIN: "var(--status-addressed-fg)",
  INSTRUCTOR: "var(--note-voice-accent)",
  ASSISTANT: "var(--status-progress-fg)",
  DANCER: "var(--muted-foreground)",
};

function TeamMark({ name }: Readonly<{ name: string }>) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .padEnd(1, "?")
    .slice(0, 2);

  return (
    <span
      aria-hidden
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-[15px] font-semibold tracking-tight text-background sm:size-12 sm:text-lg"
    >
      {initials}
    </span>
  );
}

type MetaChipProps = {
  icon: ReactNode;
  label: string;
  value: string;
  mobileLabel?: string;
};

function MetaChip({ icon, label, value, mobileLabel }: Readonly<MetaChipProps>) {
  const mobileWord = mobileLabel ?? label.toLowerCase();
  return (
    <>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span>{mobileWord}</span>
      </span>
      <span className="hidden items-center gap-1.5 leading-tight sm:inline-flex">
        <span aria-hidden className="inline-flex text-muted-foreground">
          {icon}
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </span>
    </>
  );
}

function RoleGlanceStrip({ glance }: Readonly<{ glance: RoleGlance[] }>) {
  const visible = glance.filter((entry) => entry.count > 0);
  if (visible.length === 0) return null;

  return (
    <span className="hidden flex-wrap items-center gap-x-2 gap-y-1 leading-tight sm:inline-flex">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        Roles
      </span>
      {visible.map((entry) => {
        const dotStyle: CSSProperties = {
          backgroundColor: ROLE_TONE_VAR[entry.role],
        };
        const label = ROLE_LABEL[entry.role].toLowerCase();
        const word = entry.count === 1 ? label : `${label}s`;
        return (
          <span
            key={entry.role}
            className="inline-flex items-center gap-1 text-[12px] text-foreground"
          >
            <span aria-hidden className="inline-block size-1.5 rounded-full" style={dotStyle} />
            <span className="font-semibold tabular-nums">{entry.count}</span>
            <span className="text-muted-foreground">{word}</span>
          </span>
        );
      })}
    </span>
  );
}

function MobileCountsSubtitle({
  isPersonal,
  memberCount,
  projectCount,
}: Readonly<{
  isPersonal: boolean;
  memberCount: number;
  projectCount: number;
}>) {
  const projectWord = projectCount === 1 ? "project" : "projects";
  if (isPersonal) {
    return (
      <p className="text-[12px] leading-snug text-muted-foreground sm:hidden">
        <span className="font-medium text-foreground">Personal workspace</span>
        <span aria-hidden className="mx-1.5">·</span>
        <span className="font-semibold tabular-nums text-foreground">
          {projectCount}
        </span>{" "}
        {projectWord}
      </p>
    );
  }
  return (
    <p className="text-[12px] leading-snug text-muted-foreground sm:hidden">
      <span className="font-semibold tabular-nums text-foreground">
        {memberCount}
      </span>{" "}
      {memberCount === 1 ? "member" : "members"}
      <span aria-hidden className="mx-1.5">·</span>
      <span className="font-semibold tabular-nums text-foreground">
        {projectCount}
      </span>{" "}
      {projectWord}
    </p>
  );
}

export function TeamMetaBand({
  team,
  viewerRole,
  memberCount,
  projectCount,
  roleGlance,
  createdAt,
  titleActions,
  isPersonal = false,
}: Readonly<TeamMetaBandProps>) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2.5 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-5">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground"
        >
          <Link
            href="/dashboard"
            className="shrink-0 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            Dashboard
          </Link>
          <ChevronRight aria-hidden className="size-3 shrink-0 opacity-60" />
          <span className="min-w-0 truncate font-semibold text-foreground">
            {team.name}
          </span>
        </nav>

        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <TeamMark name={team.name} />
          <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
            <div className="flex min-w-0 items-start gap-2">
              <h1 className="min-w-0 flex-1 text-xl font-semibold leading-tight tracking-tight sm:text-[28px]">
                {team.name}
              </h1>
              {titleActions ? (
                <span className="-mt-1 inline-flex shrink-0 items-center sm:mt-0">
                  {titleActions}
                </span>
              ) : null}
            </div>
            {/* Mobile: role chip lives below the title so it never orphans next to a wrapping name. */}
            {viewerRole && !isPersonal ? (
              <span className="inline-flex sm:hidden">
                <RoleChipPopover role={viewerRole} />
              </span>
            ) : null}
            {/* Mobile: compact counts subtitle replaces the generic helper line. */}
            <MobileCountsSubtitle
              isPersonal={isPersonal}
              memberCount={memberCount}
              projectCount={projectCount}
            />
            {/* Desktop helper — switches copy when in personal mode. */}
            <p className="hidden text-[13px] leading-snug text-muted-foreground sm:block">
              {isPersonal
                ? "Personal workspace — invite someone to turn this into a team."
                : "Members and projects under this team."}
            </p>
          </div>
        </div>

        {/* Meta strip is desktop-only; counts and role are inlined above on mobile.
            In personal mode, the Members chip / role glance / "Your role" are hidden
            since they all reduce to "you, ADMIN" and add noise. */}
        <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 sm:flex">
          {isPersonal ? null : (
            <MetaChip
              icon={<Users className="size-3" />}
              label="Members"
              value={String(memberCount)}
              mobileLabel={memberCount === 1 ? "member" : "members"}
            />
          )}
          <MetaChip
            icon={<Sparkles className="size-3" />}
            label="Projects"
            value={String(projectCount)}
            mobileLabel={projectCount === 1 ? "project" : "projects"}
          />
          <MetaChip
            icon={<CalendarDays className="size-3" />}
            label="Created"
            value={formatCreated(createdAt)}
          />
          {isPersonal ? null : <RoleGlanceStrip glance={roleGlance} />}

          {viewerRole && !isPersonal ? (
            <span className="ml-auto inline-flex items-center gap-2">
              <span className="hidden text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
                Your role
              </span>
              <RoleChipPopover role={viewerRole} />
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

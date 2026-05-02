import { ChevronRight, Edit3, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import { cn } from "@/lib/utils";

type TeamRole = "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";
type ProjectStatus = "ACTIVE" | "ARCHIVED";

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
};

type Team = {
  id: string;
  name: string;
};

type Contributor = {
  id: string;
  name: string | null;
  email: string;
};

type ProjectMetaBandProps = {
  team: Team;
  project: Project;
  role: TeamRole | null;
  rehearsalCount: number;
  castCount: number;
  openNotesCount: number;
  contributors: Contributor[];
  actions?: ReactNode;
};

const ROLE_LABEL: Record<TeamRole, string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  ASSISTANT: "Assistant",
  DANCER: "Dancer",
};

type StatusStyle = { label: string; bg: string; fg: string; border: string };

const STATUS_STYLES: Record<ProjectStatus, StatusStyle> = {
  ACTIVE: {
    label: "Active",
    bg: "var(--status-addressed-bg)",
    fg: "var(--status-addressed-fg)",
    border: "var(--status-addressed-border)",
  },
  ARCHIVED: {
    label: "Archived",
    bg: "var(--status-open-bg)",
    fg: "var(--muted-foreground)",
    border: "var(--status-open-border)",
  },
};

function ProjectStatusPill({ status }: Readonly<{ status: ProjectStatus }>) {
  const s = STATUS_STYLES[status];
  const style: CSSProperties = {
    backgroundColor: s.bg,
    color: s.fg,
    borderColor: s.border,
  };
  const dotStyle: CSSProperties = { backgroundColor: s.fg };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={style}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full" style={dotStyle} />
      {s.label}
    </span>
  );
}

function RolePill({ role }: Readonly<{ role: TeamRole }>) {
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

type MetaChipProps = {
  icon: ReactNode;
  /** Eyebrow label shown on desktop (e.g. "Cast"). */
  label: string;
  /** Numeric or short bold value (e.g. "14"). */
  value: string;
  /** Suffix shown after the value on desktop (e.g. "dancers"). */
  unit?: string;
  /** Lowercase noun shown after the value on mobile (e.g. "cast"). Falls back to lowercased label. */
  mobileLabel?: string;
  /** Desktop-only suffix after a `·` separator. */
  accent?: string;
  accentTone?: "progress" | "resolved";
};

const ACCENT_TONE_COLOR = {
  progress: "var(--status-progress-fg)",
  resolved: "var(--status-resolved-fg)",
} as const;

function MetaChip({
  icon,
  label,
  value,
  unit,
  mobileLabel,
  accent,
  accentTone,
}: Readonly<MetaChipProps>) {
  const accentColor = accentTone
    ? ACCENT_TONE_COLOR[accentTone]
    : "var(--muted-foreground)";
  const accentStyle: CSSProperties = { color: accentColor };
  const mobileWord = mobileLabel ?? label.toLowerCase();
  return (
    <>
      {/* Mobile: [icon] {value} {mobileLabel} — single line, no eyebrow, no accent */}
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span>{mobileWord}</span>
      </span>
      {/* Desktop: full eyebrow + value + unit + accent */}
      <span className="hidden items-center gap-1.5 leading-tight sm:inline-flex">
        <span aria-hidden className="inline-flex text-muted-foreground">
          {icon}
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-foreground">
          {unit ? `${value} ${unit}` : value}
        </span>
        {accent ? (
          <span className="text-[11px] font-medium" style={accentStyle}>
            · {accent}
          </span>
        ) : null}
      </span>
    </>
  );
}

type AvatarStackProps = {
  people: Contributor[];
  size?: number;
  max?: number;
};

function AvatarStack({
  people,
  size = 22,
  max = 4,
}: Readonly<AvatarStackProps>) {
  if (people.length === 0) return null;
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;
  return (
    <span className="inline-flex items-center">
      {visible.map((p, i) => (
        <span
          key={p.id}
          className="inline-flex rounded-full ring-2 ring-card"
          style={i === 0 ? undefined : { marginLeft: -6 }}
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
          className="inline-flex items-center justify-center rounded-full bg-muted text-[10.5px] font-semibold text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size, marginLeft: -6 }}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export function ProjectMetaBand({
  team,
  project,
  role,
  rehearsalCount,
  castCount,
  openNotesCount,
  contributors,
  actions,
}: Readonly<ProjectMetaBandProps>) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
        {/* Breadcrumb — Dashboard segment hidden on mobile to keep the chain to one line. */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link
            href="/dashboard"
            className="hidden rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline"
          >
            Dashboard
          </Link>
          <ChevronRight aria-hidden className="hidden size-3 opacity-60 sm:inline" />
          <Link
            href={`/teams/${team.id}`}
            className="rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {team.name}
          </Link>
          <ChevronRight aria-hidden className="size-3 opacity-60" />
          <span className="truncate font-semibold text-foreground">
            {project.title}
          </span>
        </nav>

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 sm:gap-x-6 sm:gap-y-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-2.5">
              <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-[28px]">
                {project.title}
              </h1>
              <ProjectStatusPill status={project.status} />
              {role ? <RolePill role={role} /> : null}
            </div>
            {project.description ? (
              <p className="line-clamp-2 max-w-2xl text-[13px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-sm sm:leading-relaxed">
                {project.description}
              </p>
            ) : null}
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {actions}
            </div>
          ) : null}
        </div>

        {/* Meta strip — flat strip on mobile (no border, single line of compact chips); divider + contributors on desktop. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-5 sm:gap-y-2 sm:border-t sm:border-border sm:pt-3">
          <MetaChip
            icon={<Sparkles className="size-3" />}
            label="Rehearsals"
            value={String(rehearsalCount)}
            mobileLabel={rehearsalCount === 1 ? "rehearsal" : "rehearsals"}
          />
          <MetaChip
            icon={<Users className="size-3" />}
            label="Cast"
            value={String(castCount)}
            unit={castCount === 1 ? "dancer" : "dancers"}
            mobileLabel="cast"
          />
          <MetaChip
            icon={<Edit3 className="size-3" />}
            label="Open notes"
            value={String(openNotesCount)}
            mobileLabel="open"
            accent={openNotesCount > 0 ? "needs review" : "all clear"}
            accentTone={openNotesCount > 0 ? "progress" : "resolved"}
          />

          {contributors.length > 0 ? (
            <span className="ml-auto hidden items-center gap-2 sm:inline-flex">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contributors
              </span>
              <AvatarStack people={contributors} />
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

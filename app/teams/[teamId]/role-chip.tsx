import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type TeamRole = "ADMIN" | "INSTRUCTOR" | "ASSISTANT" | "DANCER";

type Tone = {
  bg: string;
  fg: string;
  border: string;
};

const ROLE_TONES: Record<TeamRole, Tone> = {
  ADMIN: {
    bg: "var(--status-addressed-bg)",
    fg: "var(--status-addressed-fg)",
    border: "var(--status-addressed-border)",
  },
  INSTRUCTOR: {
    bg: "var(--note-voice-bg)",
    fg: "var(--note-voice-accent)",
    border: "var(--note-voice-border)",
  },
  ASSISTANT: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
  },
  DANCER: {
    bg: "var(--surface-sunken, var(--muted))",
    fg: "var(--muted-foreground)",
    border: "var(--border)",
  },
};

export const ROLE_LABEL: Record<TeamRole, string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  ASSISTANT: "Assistant",
  DANCER: "Dancer",
};

export type RoleInfo = {
  /** What this role sees in the team workspace. */
  sees: string;
  /** What this role can write or change. */
  canDo: string;
};

export const ROLE_INFO: Record<TeamRole, RoleInfo> = {
  ADMIN: {
    sees: "Everything in the team — members, pending invitations, projects, rehearsals, and notes.",
    canDo: "Manage members and invitations, create projects, rehearsals, and notes.",
  },
  INSTRUCTOR: {
    sees: "All team content.",
    canDo: "Create projects, rehearsals, and notes.",
  },
  ASSISTANT: {
    sees: "All team content.",
    canDo: "Create rehearsals and notes.",
  },
  DANCER: {
    sees: "Rehearsal videos and all notes (use the “@ me” filter to focus on just yours).",
    canDo: "Update status on notes assigned to you.",
  },
};

type RoleChipProps = {
  role: TeamRole;
  size?: "sm" | "md";
  className?: string;
};

export function RoleChip({
  role,
  size = "sm",
  className,
}: Readonly<RoleChipProps>) {
  const tone = ROLE_TONES[role];
  const style: CSSProperties = {
    backgroundColor: tone.bg,
    color: tone.fg,
    borderColor: tone.border,
  };
  const dotStyle: CSSProperties = { backgroundColor: tone.fg };

  return (
    <span
      data-role={role}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm"
          ? "px-2 py-0.5 text-[11px]"
          : "px-2.5 py-1 text-[12px]",
        className
      )}
      style={style}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full" style={dotStyle} />
      {ROLE_LABEL[role]}
    </span>
  );
}

export function RoleDot({ role }: Readonly<{ role: TeamRole }>) {
  const tone = ROLE_TONES[role];
  return (
    <span
      aria-hidden
      className="inline-block size-1.5 rounded-full"
      style={{ backgroundColor: tone.fg }}
    />
  );
}

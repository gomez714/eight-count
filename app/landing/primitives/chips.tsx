import { Globe, User as UserIcon, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { formatNoteTimestamp } from "@/lib/notes/format";

import { LandingAvatar, type AvatarTone } from "./avatar-initials";

export type LandingStatus = "OPEN" | "IN_PROGRESS" | "ADDRESSED" | "RESOLVED";

const STATUS_TOKENS: Record<
  LandingStatus,
  { bg: string; fg: string; border: string; label: string }
> = {
  OPEN: {
    bg: "var(--status-open-bg)",
    fg: "var(--status-open-fg)",
    border: "var(--status-open-border)",
    label: "Open",
  },
  IN_PROGRESS: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
    label: "In progress",
  },
  ADDRESSED: {
    bg: "var(--status-addressed-bg)",
    fg: "var(--status-addressed-fg)",
    border: "var(--status-addressed-border)",
    label: "Addressed",
  },
  RESOLVED: {
    bg: "var(--status-resolved-bg)",
    fg: "var(--status-resolved-fg)",
    border: "var(--status-resolved-border)",
    label: "Resolved",
  },
};

type ChipSize = "sm" | "md";

export function StatusChip({
  status,
  size = "sm",
}: Readonly<{ status: LandingStatus; size?: ChipSize }>) {
  const tokens = STATUS_TOKENS[status];
  const small = size === "sm";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold leading-none whitespace-nowrap"
      style={{
        background: tokens.bg,
        color: tokens.fg,
        border: `1px solid ${tokens.border}`,
        fontSize: small ? 10.5 : 12,
        padding: small ? "2px 7px" : "3px 9px",
      }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: tokens.fg }}
      />
      {tokens.label}
    </span>
  );
}

type TimestampAccent = "primary" | "voice";

export function TimestampPill({
  ms,
  accent = "primary",
  size = "md",
}: Readonly<{ ms: number; accent?: TimestampAccent; size?: ChipSize }>) {
  const small = size === "sm";
  const accentColor =
    accent === "voice" ? "var(--note-voice-accent)" : "var(--primary)";
  return (
    <span
      className="inline-flex items-center rounded-md font-semibold whitespace-nowrap"
      style={{
        background: `color-mix(in oklch, ${accentColor} 12%, transparent)`,
        color: "var(--foreground)",
        fontFamily: "var(--font-geist-mono)",
        fontSize: small ? 11 : 12,
        padding: small ? "2px 6px" : "3px 8px",
      }}
    >
      {formatNoteTimestamp(ms)}
    </span>
  );
}

export function TagChip({ label }: Readonly<{ label: string }>) {
  return (
    <span
      className="inline-flex items-center rounded-full font-semibold tracking-wide uppercase"
      style={{
        background: "var(--surface-sunken)",
        color: "var(--muted-foreground)",
        border: "1px solid var(--border)",
        fontSize: 10.5,
        padding: "2px 8px",
      }}
    >
      {label}
    </span>
  );
}

export type AudienceChipKind =
  | { kind: "EVERYONE"; count?: number }
  | { kind: "GROUP"; label: string; count?: number }
  | { kind: "USER"; label: string };

export function AudienceChip(props: Readonly<AudienceChipKind>) {
  if (props.kind === "EVERYONE") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full font-semibold"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontSize: 10.5,
          padding: "3px 9px",
        }}
      >
        <Globe className="size-3" />
        Full cast{props.count ? ` · ${props.count}` : ""}
      </span>
    );
  }
  if (props.kind === "GROUP") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full font-semibold"
        style={{
          background: "oklch(0.93 0.04 223)",
          color: "oklch(0.36 0.1 223)",
          border: "1px solid oklch(0.85 0.06 223)",
          fontSize: 10.5,
          padding: "3px 9px",
        }}
      >
        <Users className="size-3" />
        {props.label}
        {props.count ? ` · ${props.count}` : ""}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold"
      style={{
        background: "var(--surface-sunken)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        fontSize: 10.5,
        padding: "3px 9px",
      }}
    >
      <UserIcon className="size-3" />
      {props.label}
    </span>
  );
}

export function AssigneePip({
  initials,
  tone,
  status,
}: Readonly<{ initials: string; tone: AvatarTone; status: LandingStatus }>) {
  const tokens = STATUS_TOKENS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap"
      style={{
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        color: tokens.fg,
        fontSize: 10.5,
        padding: "2px 8px 2px 2px",
      }}
    >
      <LandingAvatar initials={initials} tone={tone} size={18} />
      <span>{initials}</span>
      <span
        aria-hidden
        className="size-1 rounded-full"
        style={{ background: tokens.fg }}
      />
      <span className="opacity-90">{tokens.label}</span>
    </span>
  );
}

export function MiniChip({
  icon,
  label,
  style,
}: Readonly<{ icon?: ReactNode; label: ReactNode; style?: CSSProperties }>) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap"
      style={{
        background: "var(--card)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        fontSize: 11,
        padding: "5px 9px",
        boxShadow:
          "0 6px 16px -6px oklch(0 0 0 / 0.2), 0 1px 2px oklch(0 0 0 / 0.05)",
        ...style,
      }}
    >
      {icon}
      {label}
    </span>
  );
}

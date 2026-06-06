import { ChevronRight, Mic, Repeat } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import type { ActivityActor, ActivityScope } from "@/lib/activity/types";
import { formatNoteTimestamp } from "@/lib/notes/format";
import { NOTE_STATUS_LABELS, type NoteStatus } from "@/lib/notes/statuses";
import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

/**
 * Activity row primitives. The base `ActivityRow` is a single tappable
 * surface: a `<Link>` carrying hover/focus affordances (left-stripe,
 * surface-sunken tint, reveal-chevron). Helper subcomponents express the
 * common slots — header (actor + age), meta (small-caps scope), body —
 * so per-kind variants stay terse and visually consistent.
 *
 * `pickAvatarTone` is applied upstream in the activity data layer so the
 * actor avatar's tone matches the actor across the app.
 */

/* ----------------------------- base row ----------------------------- */

type ActivityRowProps = {
  href: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function ActivityRow({
  href,
  ariaLabel,
  children,
}: Readonly<ActivityRowProps>) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
        "hover:bg-(--surface-sunken)",
        "focus-visible:bg-(--surface-sunken) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-2 bottom-2 w-[2px] rounded-sm bg-transparent transition-colors",
          "group-hover:bg-primary group-focus-visible:bg-primary"
        )}
      />
      {children}
      <ChevronRight
        aria-hidden
        className={cn(
          "mt-1 h-4 w-4 shrink-0 self-start text-muted-foreground opacity-0 transition-all",
          "group-hover:translate-x-0.5 group-hover:opacity-100",
          "group-focus-visible:translate-x-0.5 group-focus-visible:opacity-100"
        )}
      />
    </Link>
  );
}

/* ----------------------------- header ----------------------------- */

type ActivityHeaderProps = {
  actor: ActivityActor;
  /** Action sentence — e.g. "added a note for you". */
  prefix: ReactNode;
  /** Relative age — e.g. "5m". */
  age: string;
  /** Small dot indicator before the actor (for unread-ish state). Optional. */
  highlight?: boolean;
};

export function ActivityHeader({
  actor,
  prefix,
  age,
  highlight,
}: Readonly<ActivityHeaderProps>) {
  return (
    <div className="flex items-baseline gap-1.5 text-[13.5px] leading-snug">
      {highlight ? (
        <span
          aria-hidden
          className="mr-0.5 inline-block h-1.5 w-1.5 self-center rounded-full"
          style={{ background: "var(--discussion-accent)" }}
        />
      ) : null}
      <span className="font-semibold text-foreground">
        {actor.name ?? "Someone"}
      </span>
      <span className="text-muted-foreground">{prefix}</span>
      <span className="ml-auto shrink-0 text-[11.5px] text-muted-foreground">
        {age}
      </span>
    </div>
  );
}

/* ----------------------------- meta ------------------------------- */

type ActivityMetaProps = {
  scope: ActivityScope;
  timestampMs?: number | null;
  tag?: NoteTag | null;
};

export function ActivityMeta({
  scope,
  timestampMs,
  tag,
}: Readonly<ActivityMetaProps>) {
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] font-bold uppercase leading-none tracking-[0.12em] text-muted-foreground">
      <span>{scope.projectTitle}</span>
      {scope.rehearsalTitle ? (
        <>
          <MetaSep />
          <span>{scope.rehearsalTitle}</span>
        </>
      ) : null}
      {typeof timestampMs === "number" ? (
        <>
          <MetaSep />
          <span
            className="font-mono"
            style={{ color: "var(--primary)", letterSpacing: 0 }}
          >
            {formatNoteTimestamp(timestampMs)}
          </span>
        </>
      ) : null}
      {tag ? (
        <>
          <MetaSep />
          <span>{NOTE_TAG_LABELS[tag]}</span>
        </>
      ) : null}
    </div>
  );
}

function MetaSep() {
  return (
    <span
      aria-hidden
      className="inline-block h-[3px] w-[3px] rounded-full bg-border"
    />
  );
}

/* ----------------------------- body slots ------------------------------- */

export function ActivityBody({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-foreground/85">
      {children}
    </p>
  );
}

export function ActivityBodyMuted({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <p className="mt-1.5 line-clamp-2 text-[13px] italic leading-snug text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Quoted reply / parent excerpt — used by thread-reply rows for the
 * "Maya replied: …" body line.
 */
export function ActivityQuote({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <p
      className="mt-1.5 line-clamp-2 border-l-2 pl-2 text-[13px] leading-snug text-foreground/85"
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </p>
  );
}

/* ----------------------------- voice peek ------------------------------- */

/**
 * Static voice-note teaser. Looks like the coral player but isn't
 * interactive on its own — clicking the activity row navigates to the
 * note where the real player lives. Keeps the feed server-rendered.
 */
type VoicePeekProps = {
  durationMs: number | null;
  /** Transcript excerpt shown beneath when status is READY + non-empty. */
  transcript: string | null;
};

export function VoicePeek({
  durationMs,
  transcript,
}: Readonly<VoicePeekProps>) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      <div
        className="inline-flex items-center gap-2 self-start rounded-full px-2.5 py-1 text-[11.5px]"
        style={{
          background: "var(--note-voice-bg)",
          border: "1px solid var(--note-voice-border)",
          color: "var(--note-voice-accent)",
        }}
      >
        <Mic className="h-3 w-3" aria-hidden />
        <span className="font-mono">
          {durationMs ? formatNoteTimestamp(durationMs) : "0:00"}
        </span>
      </div>
      {transcript ? (
        <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
          {transcript}
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------- status pill ------------------------------ */

const STATUS_PALETTE: Record<NoteStatus, { bg: string; fg: string; border: string }> = {
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

export function StatusPill({ status }: Readonly<{ status: NoteStatus }>) {
  const p = STATUS_PALETTE[status];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
      style={{ background: p.bg, color: p.fg, borderColor: p.border }}
    >
      {NOTE_STATUS_LABELS[status]}
    </span>
  );
}

/* ----------------------------- repeating ------------------------------ */

export function RepeatingPip({
  count,
  tag,
}: Readonly<{ count: number; tag: NoteTag | null }>) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold"
      style={{
        background: "var(--repeating-bg)",
        color: "var(--repeating-fg)",
        borderColor: "var(--repeating-border)",
      }}
    >
      <Repeat className="h-2.5 w-2.5" aria-hidden />
      {tag ? NOTE_TAG_LABELS[tag] : "Repeating"} × {count}
    </span>
  );
}

/* ----------------------------- frame slot ------------------------------ */

/**
 * Compact actor-tagged avatar wrapper used by every variant's left slot.
 * Keeps the size consistent (28px) across kinds.
 */
export function ActivityAvatar({ actor }: Readonly<{ actor: ActivityActor }>) {
  return (
    <AvatarInitials
      name={actor.name}
      toneSeed={actor.id}
      tone={actor.tone}
      size={28}
    />
  );
}


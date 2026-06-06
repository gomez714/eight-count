import { Plus, Repeat, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import type { UpNextPick } from "@/lib/activity/pick-up-next";
import { formatNoteTimestamp } from "@/lib/notes/format";
import { NOTE_TAG_LABELS } from "@/lib/notes/tags";

import { FrameThumb } from "./frame-thumb";

/**
 * The pinned Up Next card at the top of the V2 dashboard feed.
 * Branches on `pick.reason` — variants share a frame-backdrop +
 * dark-overlay structure but carry different copy, CTAs, and accents.
 *
 * The whole card is a single `<Link>` so any tap navigates to the
 * appropriate surface. Eyebrow text (`pick.whyLine`) is produced by
 * `pickUpNext` so the algorithm and the surfaced justification stay
 * coupled.
 *
 * `id="up-next"` anchors the dedup `PinnedAboveMarker` rows in the
 * feed — tapping "↑ shown above" scrolls the user back to this card.
 */

export function PinCard({ pick }: Readonly<{ pick: UpNextPick }>) {
  switch (pick.reason) {
    case "oldest-unresolved":
      return <OldestUnresolvedPin pick={pick} />;
    case "unfinished-rehearsal":
      return <UnfinishedRehearsalPin pick={pick} />;
    case "unread-thread":
      return <UnreadThreadPin pick={pick} />;
    case "first-note":
      return <FirstNotePin pick={pick} />;
  }
}

/* ---------------------------- shared shell ---------------------------- */

type ShellProps = {
  whyLine: string;
  href: string;
  ariaLabel: string;
  children: ReactNode;
};

function PinShell({ whyLine, href, ariaLabel, children }: Readonly<ShellProps>) {
  return (
    <section
      id="up-next"
      aria-labelledby="up-next-eyebrow"
      className="flex flex-col gap-2 rounded-2xl p-3"
      style={{
        background: "color-mix(in oklch, var(--primary) 7%, var(--surface-card))",
        border: "1px solid color-mix(in oklch, var(--primary) 26%, var(--border))",
      }}
    >
      <div className="flex items-center gap-2 px-1">
        <span
          id="up-next-eyebrow"
          className="inline-flex items-center gap-1.5"
          style={{ color: "var(--primary)" }}
        >
          <Zap className="h-3.5 w-3.5" aria-hidden />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em]">
            Up next
          </span>
        </span>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          {whyLine}
        </span>
      </div>

      <Link
        href={href}
        aria-label={ariaLabel}
        className="group relative block overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </Link>
    </section>
  );
}

/* --------------------------- oldest-unresolved -------------------------- */

function OldestUnresolvedPin({
  pick,
}: Readonly<{
  pick: Extract<UpNextPick, { reason: "oldest-unresolved" }>;
}>) {
  const { data } = pick;
  if (!data.scope.rehearsalId) return null;
  const href = `/rehearsals/${data.scope.rehearsalId}`;
  return (
    <PinShell
      whyLine={pick.whyLine}
      href={href}
      ariaLabel={`Open ${data.author.name ?? "the"} note`}
    >
      <BackdropFrame
        rehearsalId={data.scope.rehearsalId}
        ms={data.startTimestampMs}
        tone={data.noteType === "VOICE" ? "coral" : "teal"}
      />
      <FrameOverlayChrome
        ms={data.startTimestampMs}
        repeatingCount={data.repeatingCount}
      />
      <FrameOverlayBody
        eyebrow={buildScopeEyebrow(data.scope, data.tag)}
        body={data.bodyText ?? "Voice note"}
        actor={{
          id: data.author.id,
          name: data.author.name,
          tone: data.author.tone,
          subtitle: data.selfAuthored
            ? "Your own note"
            : (data.author.name ?? "Author"),
        }}
        cta="Open"
      />
    </PinShell>
  );
}

/* --------------------------- unfinished-rehearsal ----------------------- */

function UnfinishedRehearsalPin({
  pick,
}: Readonly<{
  pick: Extract<UpNextPick, { reason: "unfinished-rehearsal" }>;
}>) {
  const { data } = pick;
  const href = `/rehearsals/${data.rehearsalId}`;
  return (
    <PinShell
      whyLine={pick.whyLine}
      href={href}
      ariaLabel={`Open ${data.rehearsalTitle}`}
    >
      <BackdropFrame
        rehearsalId={data.rehearsalId}
        ms={data.startTimestampMs}
        tone="teal"
      />
      <FrameOverlayChrome ms={data.startTimestampMs} repeatingCount={null} />
      <FrameOverlayBody
        eyebrow={`${data.scope.projectTitle} · ${data.rehearsalTitle}`}
        body="Pick back up where you left off"
        cta="Open"
      />
    </PinShell>
  );
}

/* ------------------------------ unread-thread --------------------------- */

function UnreadThreadPin({
  pick,
}: Readonly<{ pick: Extract<UpNextPick, { reason: "unread-thread" }> }>) {
  const { data } = pick;
  const href = data.scope.rehearsalId
    ? `/rehearsals/${data.scope.rehearsalId}`
    : `/projects/${data.scope.projectId}`;
  return (
    <PinShell
      whyLine={pick.whyLine}
      href={href}
      ariaLabel={`Open thread with ${data.replyAuthor.name ?? "new reply"}`}
    >
      {data.scope.rehearsalId && data.parentStartTimestampMs !== null ? (
        <BackdropFrame
          rehearsalId={data.scope.rehearsalId}
          ms={data.parentStartTimestampMs}
          tone="teal"
        />
      ) : (
        <NoFrameBackdrop />
      )}
      <FrameOverlayChrome
        ms={data.parentStartTimestampMs}
        repeatingCount={null}
      />
      <FrameOverlayBody
        eyebrow={`${data.scope.projectTitle}${
          data.scope.rehearsalTitle ? ` · ${data.scope.rehearsalTitle}` : ""
        }`}
        body={
          data.bodyExcerpt ?? "Open the thread to see what's new"
        }
        actor={{
          id: data.replyAuthor.id,
          name: data.replyAuthor.name,
          tone: data.replyAuthor.tone,
          subtitle: `replied · ${data.unreadCount} new`,
        }}
        cta="Open"
      />
    </PinShell>
  );
}

/* -------------------------------- first-note ---------------------------- */

function FirstNotePin({
  pick,
}: Readonly<{ pick: Extract<UpNextPick, { reason: "first-note" }> }>) {
  const { data } = pick;
  const href = `/rehearsals/${data.rehearsalId}`;
  return (
    <PinShell
      whyLine={pick.whyLine}
      href={href}
      ariaLabel={`Leave your first note on ${data.rehearsalTitle}`}
    >
      <BackdropFrame rehearsalId={data.rehearsalId} ms={0} tone="teal" />
      <FrameOverlayBody
        eyebrow={`${data.scope.projectTitle} · ${data.rehearsalTitle}`}
        body="Your rehearsal's up — leave your first note."
        ctaIcon={<Plus className="h-3.5 w-3.5" />}
        cta="Add a note"
      />
    </PinShell>
  );
}

/* ============================== building blocks ========================== */

function BackdropFrame({
  rehearsalId,
  ms,
  tone,
}: Readonly<{ rehearsalId: string; ms: number; tone: "teal" | "coral" }>) {
  return (
    <div className="relative aspect-16/10 w-full">
      <FrameThumb
        rehearsalId={rehearsalId}
        ms={ms}
        tone={tone}
        fill
        caption={false}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, oklch(0 0 0 / 0.84) 0%, oklch(0 0 0 / 0.2) 48%, transparent 72%)",
        }}
      />
    </div>
  );
}

function NoFrameBackdrop() {
  return (
    <div className="relative aspect-16/10 w-full">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, var(--cinema-bg) 0%, var(--cinema-card) 60%, var(--cinema-bg) 100%)",
        }}
      />
    </div>
  );
}

function FrameOverlayChrome({
  ms,
  repeatingCount,
}: Readonly<{ ms: number | null; repeatingCount: number | null }>) {
  return (
    <>
      {typeof ms === "number" ? (
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11.5px] font-semibold text-white"
          style={{
            background: "oklch(0 0 0 / 0.45)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span aria-hidden>▶</span>
          {formatNoteTimestamp(ms)}
        </span>
      ) : null}
      {repeatingCount ? (
        <span
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white"
          style={{
            background: "color-mix(in oklch, var(--repeating-fg) 88%, black)",
          }}
        >
          <Repeat className="h-2.5 w-2.5" aria-hidden />
          Repeating × {repeatingCount}
        </span>
      ) : null}
    </>
  );
}

type OverlayActor = {
  id: string;
  name: string | null;
  tone: "neutral" | "teal" | "coral" | "olive" | "plum";
  subtitle: string;
};

function FrameOverlayBody({
  eyebrow,
  body,
  actor,
  cta,
  ctaIcon,
}: Readonly<{
  eyebrow: string;
  body: string;
  actor?: OverlayActor;
  cta: string;
  ctaIcon?: ReactNode;
}>) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3.5 text-white">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/85">
        {eyebrow}
      </span>
      <p className="text-[15.5px] font-semibold leading-snug tracking-tight">
        {body}
      </p>
      <div className="flex items-center gap-2">
        {actor ? (
          <>
            <AvatarInitials
              name={actor.name}
              toneSeed={actor.id}
              tone={actor.tone}
              size={22}
            />
            <span className="min-w-0 truncate text-[11.5px] text-white/85">
              {actor.subtitle}
            </span>
          </>
        ) : null}
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[12px] font-bold transition-transform group-hover:translate-x-0.5"
          style={{ color: "oklch(0.2 0 0)" }}
        >
          {ctaIcon}
          {cta}
          <span aria-hidden>→</span>
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- helpers ------------------------------- */

function buildScopeEyebrow(
  scope: { projectTitle: string; rehearsalTitle: string | null },
  tag: string | null
): string {
  const parts = [scope.projectTitle];
  if (scope.rehearsalTitle) parts.push(scope.rehearsalTitle);
  if (tag) parts.push(NOTE_TAG_LABELS[tag as keyof typeof NOTE_TAG_LABELS] ?? tag);
  return parts.join(" · ");
}


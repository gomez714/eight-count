import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The quiet meta line under the "Welcome back" heading. Same data as the
 * old `MetaChip` row, but presented as muted navigational text with
 * dotted underlines — kpis demoted from "dashboard tile" to "where to
 * go next." Each segment is a `<Link>` so the line doubles as nav.
 *
 * "New replies" is broken out into its own indigo pill because it
 * carries a state change (someone wrote to you) that the muted-text
 * treatment would lose. Only renders when `unreadReplies > 0`.
 */

type MetaLineProps = {
  teamsCount: number;
  onPlateCount: number;
  notesByMeSent?: number;
  notesByMeStalled?: number;
  unreadReplies: number;
  /** When false, the notes-by-me segment is hidden (pure dancers). */
  showNotesByMe?: boolean;
};

export function MetaLine({
  teamsCount,
  onPlateCount,
  notesByMeSent = 0,
  notesByMeStalled = 0,
  unreadReplies,
  showNotesByMe = false,
}: Readonly<MetaLineProps>) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted-foreground">
      <Link
        href="/dashboard#teams"
        className="rounded underline decoration-border decoration-dotted underline-offset-[3px] hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {teamsCount} {teamsCount === 1 ? "team" : "teams"}
      </Link>

      {onPlateCount > 0 ? (
        <>
          <Separator />
          <Link
            href="/my-notes"
            className={cn(
              "rounded underline decoration-border decoration-dotted underline-offset-[3px] hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "font-bold text-foreground"
            )}
          >
            {onPlateCount} on your plate
          </Link>
        </>
      ) : null}

      {showNotesByMe && notesByMeSent > 0 ? (
        <>
          <Separator />
          <Link
            href="/notes-by-me"
            className={cn(
              "rounded underline decoration-border decoration-dotted underline-offset-[3px] hover:decoration-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              notesByMeStalled > 0
                ? "text-[color:var(--status-progress-fg)] hover:text-[color:var(--status-progress-fg)]"
                : "hover:text-foreground"
            )}
          >
            {notesByMeSent} sent
            {notesByMeStalled > 0 ? ` · ${notesByMeStalled} stalled` : ""}
          </Link>
        </>
      ) : null}

      {unreadReplies > 0 ? (
        <Link
          href="/my-notes"
          className="ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            background: "var(--discussion-bg)",
            color: "var(--discussion-accent)",
            borderColor: "var(--discussion-border)",
          }}
        >
          <MessageCircle className="h-3 w-3" />
          {unreadReplies} new {unreadReplies === 1 ? "reply" : "replies"}
        </Link>
      ) : null}
    </div>
  );
}

function Separator() {
  return (
    <span
      aria-hidden
      className="inline-block h-[3px] w-[3px] rounded-full bg-border"
    />
  );
}

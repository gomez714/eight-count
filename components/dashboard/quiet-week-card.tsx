import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { FrameThumb } from "./frame-thumb";

/**
 * Seven-days-zero-activity empty state. Replaces the activity feed
 * entirely while still offering one quiet exit (the user's most recent
 * rehearsal as a "Pick back up" card). No "create a team" CTA, no
 * shame copy — quiet weeks are allowed.
 *
 * `lastActorName` + `lastActivityDaysAgo` surface a personal hook
 * ("Your last note from Maya was 5 days ago"). Both optional; if
 * either is missing the copy gracefully degrades.
 */

type QuietWeekCardProps = {
  lastActorName?: string | null;
  lastActivityDaysAgo?: number | null;
  pickBackUp: {
    rehearsalId: string;
    rehearsalTitle: string;
    projectTitle: string;
  } | null;
};

export function QuietWeekCard({
  lastActorName,
  lastActivityDaysAgo,
  pickBackUp,
}: Readonly<QuietWeekCardProps>) {
  return (
    <section
      aria-labelledby="quiet-week-heading"
      className="flex flex-col gap-3"
    >
      <p
        id="quiet-week-heading-eyebrow"
        className="px-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        This week
      </p>

      <h2
        id="quiet-week-heading"
        className="px-1 text-[18px] font-medium leading-snug tracking-tight text-foreground/90"
      >
        Quiet week — nothing new across your teams.
        {lastActorName && lastActivityDaysAgo ? (
          <>
            {" "}
            <span className="text-muted-foreground">
              Your last note from {lastActorName} was {lastActivityDaysAgo}{" "}
              {lastActivityDaysAgo === 1 ? "day" : "days"} ago.
            </span>
          </>
        ) : null}
      </h2>

      {pickBackUp ? (
        <Link
          href={`/rehearsals/${pickBackUp.rehearsalId}`}
          className="group flex items-stretch gap-3 overflow-hidden rounded-xl border bg-card p-1 transition-colors hover:bg-(--surface-sunken) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="w-[110px] shrink-0">
            <FrameThumb
              rehearsalId={pickBackUp.rehearsalId}
              ms={0}
              tone="teal"
              caption={false}
              aspect="16 / 10"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1 pr-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Pick back up
            </span>
            <p className="truncate text-[14px] font-semibold leading-snug">
              {pickBackUp.projectTitle}
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              Open {pickBackUp.rehearsalTitle} — your most recent run
            </p>
          </div>
          <ChevronRight
            aria-hidden
            className="mr-2 h-4 w-4 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ) : null}
    </section>
  );
}

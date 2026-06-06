import Link from "next/link";
import type { ReactNode } from "react";

import type { ActivityItem } from "@/lib/activity/types";
import { cn } from "@/lib/utils";

import {
  DiscussionStartedRow,
  NoteAddedRow,
  StatusChangeRow,
  ThreadReplyRow,
} from "./activity-row-variants";
import { PinnedAboveMarker } from "./pinned-above-marker";

/**
 * Activity feed shell. Buckets items by relative recency (Today /
 * Earlier this week / Older), dispatches each to the right per-kind
 * row, and renders a "Show older" tail when more pages exist.
 *
 * Dedup with the pinned Up Next card lives here: when `pinnedNoteId` /
 * `pinnedDiscussionId` matches a row's target AND the row is the topmost
 * Today item (within the dedup window), render a `PinnedAboveMarker`
 * placeholder instead. Beyond the top-of-feed, duplication is allowed —
 * the activity is genuinely a separate event by then.
 *
 * Section heading: when 100% of items are by the viewer themselves
 * (passed via `allSelf`), the header reads "YOUR NOTES" rather than
 * "RECENT ACTIVITY". This is the personal-workspace re-entry path; the
 * page entry detects the state and threads the flag down.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PIN_DEDUP_WINDOW_MS = 30 * 60 * 1000;

type ActivityFeedProps = {
  items: ActivityItem[];
  hasMore: boolean;
  nextCursor: string | null;
  /** Note id of the pinned Up Next card, when one is shown. */
  pinnedNoteId?: string | null;
  /** Discussion id of the pinned Up Next card, when applicable. */
  pinnedDiscussionId?: string | null;
  /** When true, the feed represents the viewer's own notes. */
  allSelf?: boolean;
  /** Used for relative-time bucketing; defaults to `new Date()`. */
  now?: Date;
};

export function ActivityFeed({
  items,
  hasMore,
  nextCursor,
  pinnedNoteId = null,
  pinnedDiscussionId = null,
  allSelf = false,
  now = new Date(),
}: Readonly<ActivityFeedProps>) {
  if (items.length === 0) return null;

  const buckets = bucketByRecency(items, now);
  const sectionTitle = allSelf ? "Your notes" : "Recent activity";

  return (
    <section
      aria-labelledby="activity-section-heading"
      className="flex flex-col gap-3"
    >
      <h2
        id="activity-section-heading"
        className="px-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {sectionTitle}
      </h2>

      <div className="flex flex-col gap-4">
        <Bucket
          title="Today"
          items={buckets.today}
          now={now}
          pinnedNoteId={pinnedNoteId}
          pinnedDiscussionId={pinnedDiscussionId}
        />
        <Bucket
          title="Earlier this week"
          items={buckets.earlier}
          now={now}
        />
        <Bucket title="Older" items={buckets.older} now={now} />
      </div>

      {hasMore && nextCursor ? (
        <div className="flex justify-center pt-1">
          <Link
            href={`/dashboard?cursor=${encodeURIComponent(nextCursor)}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
              "hover:bg-(--surface-sunken)",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            Show older activity →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------ bucket ------------------------------ */

type BucketProps = {
  title: string;
  items: ActivityItem[];
  now: Date;
  pinnedNoteId?: string | null;
  pinnedDiscussionId?: string | null;
};

function Bucket({
  title,
  items,
  now,
  pinnedNoteId = null,
  pinnedDiscussionId = null,
}: Readonly<BucketProps>) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item, idx) => {
          // Dedup is only applied at the very top of the feed and only
          // within a short window so we don't suppress unrelated activity.
          const ageMs = now.getTime() - item.createdAt.getTime();
          const dedupCandidate =
            idx === 0 && ageMs <= PIN_DEDUP_WINDOW_MS;
          if (dedupCandidate) {
            const marker = pinMarkerForItem(item, {
              pinnedNoteId,
              pinnedDiscussionId,
              now,
            });
            if (marker) return <FragmentKeyed key={item.id} node={marker} />;
          }
          return <FragmentKeyed key={item.id} node={renderItem(item, now)} />;
        })}
      </div>
    </div>
  );
}

function FragmentKeyed({ node }: Readonly<{ node: ReactNode }>) {
  return <>{node}</>;
}

/* ----------------------------- dispatch ----------------------------- */

function renderItem(item: ActivityItem, now: Date): ReactNode {
  const age = formatRelativeAge(item.createdAt, now);
  switch (item.kind) {
    case "note-added":
      return <NoteAddedRow item={item} age={age} />;
    case "thread-reply":
      return <ThreadReplyRow item={item} age={age} highlight />;
    case "status-change":
      return <StatusChangeRow item={item} age={age} />;
    case "discussion-started":
      return <DiscussionStartedRow item={item} age={age} />;
  }
}

/* ----------------------------- dedup ------------------------------ */

function pinMarkerForItem(
  item: ActivityItem,
  ctx: {
    pinnedNoteId: string | null;
    pinnedDiscussionId: string | null;
    now: Date;
  }
): ReactNode | null {
  const age = formatRelativeAge(item.createdAt, ctx.now);
  const actorName = item.actor.name ?? "Someone";

  // Note-targeted pin matches against note-added and note-thread-reply.
  if (ctx.pinnedNoteId) {
    if (item.kind === "note-added" && item.noteId === ctx.pinnedNoteId) {
      return (
        <PinnedAboveMarker
          description={`${actorName}'s note`}
          age={age}
        />
      );
    }
    if (
      item.kind === "thread-reply" &&
      item.parent.type === "note" &&
      item.parent.noteId === ctx.pinnedNoteId
    ) {
      return (
        <PinnedAboveMarker
          description={`${actorName}'s reply`}
          age={age}
        />
      );
    }
  }

  // Discussion-targeted pin matches against discussion-started and
  // discussion-thread-reply.
  if (ctx.pinnedDiscussionId) {
    if (
      item.kind === "discussion-started" &&
      item.discussionId === ctx.pinnedDiscussionId
    ) {
      return (
        <PinnedAboveMarker
          description={`${actorName}'s discussion`}
          age={age}
        />
      );
    }
    if (
      item.kind === "thread-reply" &&
      item.parent.type === "discussion" &&
      item.parent.discussionId === ctx.pinnedDiscussionId
    ) {
      return (
        <PinnedAboveMarker
          description={`${actorName}'s reply`}
          age={age}
        />
      );
    }
  }

  return null;
}

/* ----------------------------- helpers ----------------------------- */

type Bucketed = {
  today: ActivityItem[];
  earlier: ActivityItem[];
  older: ActivityItem[];
};

function bucketByRecency(items: ActivityItem[], now: Date): Bucketed {
  const out: Bucketed = { today: [], earlier: [], older: [] };
  const today = startOfDay(now).getTime();
  const sevenAgo = now.getTime() - 7 * DAY_MS;
  for (const item of items) {
    const t = item.createdAt.getTime();
    if (t >= today) {
      out.today.push(item);
    } else if (t >= sevenAgo) {
      out.earlier.push(item);
    } else {
      out.older.push(item);
    }
  }
  return out;
}

function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatRelativeAge(date: Date, now: Date): string {
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

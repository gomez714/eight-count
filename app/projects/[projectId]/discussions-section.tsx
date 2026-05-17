"use client";

import { ChevronDown, ChevronRight, MessagesSquare } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ThreadExpansionProvider } from "@/components/threads/thread-expansion-context";
import { cn } from "@/lib/utils";

import { ProjectDiscussionComposer } from "./project-discussion-composer";
import {
  ProjectDiscussionRow,
  type ProjectDiscussionItem,
} from "./project-discussion-row";

/**
 * Hard cap that matches `getDiscussionsForProject(... take: 50)`. When
 * the returned list length equals this, we surface "Showing the latest
 * N" copy at the bottom so users know more exist on the server. Real
 * pagination (cursor + load-more) is deferred until usage data justifies
 * the maintenance cost — see Decisions log in docs/plans/discussion-layer.md.
 */
const PROJECT_DISCUSSIONS_CAP = 50;

/**
 * URL key that persists the section's expanded state. Bookmarks +
 * back/forward survive a refresh; the default (no param) is collapsed.
 */
const URL_KEY = "discussions";
const URL_OPEN_VALUE = "open";

type DiscussionsSectionProps = {
  projectId: string;
  discussions: ProjectDiscussionItem[];
  currentUserId: string;
  /**
   * Author-or-staff at the project level — drives the transcript-retry
   * button on voice rows. Staff is everyone with ADMIN/INSTRUCTOR/ASSISTANT
   * on this project's team; the row itself further narrows to "author or
   * staff" inside its own check (the API enforces it regardless).
   */
  canRetryTranscript: boolean;
};

export function DiscussionsSection({
  projectId,
  discussions,
  currentUserId,
  canRetryTranscript,
}: Readonly<DiscussionsSectionProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const expanded = searchParams.get(URL_KEY) === URL_OPEN_VALUE;

  const unreadCount = useMemo(
    () => discussions.filter((d) => d.thread.hasUnread).length,
    [discussions]
  );
  const hitCap = discussions.length >= PROJECT_DISCUSSIONS_CAP;

  const toggle = () => {
    const next = new URLSearchParams(searchParams);
    if (expanded) {
      next.delete(URL_KEY);
    } else {
      next.set(URL_KEY, URL_OPEN_VALUE);
    }
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  };

  const handleDeleted = () => router.refresh();

  return (
    <Card>
      <CardContent className={cn("flex flex-col gap-0 p-0")}>
        <CollapsedHeader
          expanded={expanded}
          totalCount={discussions.length}
          unreadCount={unreadCount}
          onToggle={toggle}
        />

        {expanded ? (
          <ThreadExpansionProvider>
            <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:px-6 sm:py-5">
              <p className="text-xs text-muted-foreground">
                Open-ended creative and process questions about this piece
                — intention, quality, alternative approaches. Anyone on
                the team can start one; rehearsal-anchored discussions
                from any session also appear here.
              </p>

              <ProjectDiscussionComposer projectId={projectId} />

              {discussions.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex flex-col gap-3">
                  {discussions.map((d) => (
                    <ProjectDiscussionRow
                      key={d.id}
                      discussion={d}
                      currentUserId={currentUserId}
                      canRetryTranscript={canRetryTranscript}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </div>
              )}

              {hitCap ? (
                <p className="text-center text-xs text-muted-foreground">
                  Showing the latest {PROJECT_DISCUSSIONS_CAP} discussions.
                  Older ones still exist — let us know if you need to see
                  them and we&apos;ll wire up pagination.
                </p>
              ) : null}
            </div>
          </ThreadExpansionProvider>
        ) : null}
      </CardContent>
    </Card>
  );
}

type CollapsedHeaderProps = {
  expanded: boolean;
  totalCount: number;
  unreadCount: number;
  onToggle: () => void;
};

function CollapsedHeader({
  expanded,
  totalCount,
  unreadCount,
  onToggle,
}: Readonly<CollapsedHeaderProps>) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls="project-discussions-body"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors",
        "hover:bg-muted/40"
      )}
    >
      <MessagesSquare
        className="size-4 shrink-0"
        style={{ color: "var(--discussion-accent)" }}
        aria-hidden
      />
      <span className="font-medium">Discussions</span>
      <span className="tabular-nums text-sm text-muted-foreground">
        {totalCount}
      </span>
      {unreadCount > 0 ? (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--primary) 14%, var(--card))",
            color: "var(--primary)",
          }}
          aria-label={`${unreadCount} discussions with unread replies`}
        >
          {unreadCount} unread
        </span>
      ) : null}
      <Chevron
        className="ml-auto size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
      <MessagesSquare
        className="size-6"
        style={{ color: "var(--discussion-accent)" }}
        aria-hidden
      />
      <p className="text-sm font-medium">No discussions yet</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Start one with the composer above. Discussions are for the
        open-ended questions that don&apos;t fit a single correction —
        what the piece is about, what quality to engage, alternative
        approaches.
      </p>
    </div>
  );
}

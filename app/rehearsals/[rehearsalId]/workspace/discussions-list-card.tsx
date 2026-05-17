"use client";

import { MessagesSquare } from "lucide-react";
import type { RefObject } from "react";
import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { DiscussionRow } from "./discussion-row";
import type { DiscussionItem } from "./types";

type DiscussionsFilter = "ALL" | "UNANCHORED" | "VOICE" | "MINE";

const FILTERS: ReadonlyArray<{
  key: DiscussionsFilter;
  label: string;
}> = [
  { key: "ALL", label: "All" },
  { key: "UNANCHORED", label: "Rehearsal-wide" },
  { key: "VOICE", label: "Voice" },
  { key: "MINE", label: "By me" },
];

type DiscussionsListCardProps = {
  discussions: DiscussionItem[];
  currentUserId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onJumpToTimestamp: (timestampMs: number) => void;
  onSyncPlaybackChange: (audioAssetId: string, isPlaying: boolean) => void;
  onDiscussionDeleted: () => void;
  /**
   * When true, voice-discussion rows surface the transcript-retry button
   * for failed transcripts. Author-or-staff at the workspace level —
   * matches the API gate.
   */
  canRetryTranscript: boolean;
};

export function DiscussionsListCard({
  discussions,
  currentUserId,
  videoRef,
  onJumpToTimestamp,
  onSyncPlaybackChange,
  onDiscussionDeleted,
  canRetryTranscript,
}: Readonly<DiscussionsListCardProps>) {
  const [filter, setFilter] = useState<DiscussionsFilter>("ALL");

  const counts = useMemo(() => {
    const unanchored = discussions.filter(
      (d) => d.startTimestampMs === null
    ).length;
    const voice = discussions.filter((d) => d.noteType === "VOICE").length;
    const mine = discussions.filter(
      (d) => d.author.id === currentUserId
    ).length;
    return {
      ALL: discussions.length,
      UNANCHORED: unanchored,
      VOICE: voice,
      MINE: mine,
    } satisfies Record<DiscussionsFilter, number>;
  }, [discussions, currentUserId]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "UNANCHORED":
        return discussions.filter((d) => d.startTimestampMs === null);
      case "VOICE":
        return discussions.filter((d) => d.noteType === "VOICE");
      case "MINE":
        return discussions.filter((d) => d.author.id === currentUserId);
      default:
        return discussions;
    }
  }, [discussions, currentUserId, filter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discussions</CardTitle>
        <CardDescription>
          Open-ended creative + process questions. Anyone on the team can
          start one. No status, no follow-through — just conversation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Filter discussions"
          className="flex flex-wrap gap-1.5"
        >
          {FILTERS.map(({ key, label }) => (
            <FilterPill
              key={key}
              label={label}
              count={counts[key]}
              active={filter === key}
              onClick={() => setFilter(key)}
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            isFiltered={filter !== "ALL"}
            totalCount={discussions.length}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((discussion) => (
              <DiscussionRow
                key={discussion.id}
                discussion={discussion}
                currentUserId={currentUserId}
                videoRef={videoRef}
                onJumpToTimestamp={onJumpToTimestamp}
                onSyncPlaybackChange={onSyncPlaybackChange}
                onDeleted={onDiscussionDeleted}
                canRetryTranscript={canRetryTranscript}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FilterPillProps = {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

function FilterPill({
  label,
  count,
  active,
  onClick,
}: Readonly<FilterPillProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        active
          ? "text-background"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      style={
        active
          ? {
              backgroundColor: "var(--discussion-accent)",
              borderColor: "var(--discussion-accent)",
            }
          : undefined
      }
    >
      {label}
      <span
        className={cn(
          "tabular-nums text-[11px]",
          active ? "opacity-80" : "text-muted-foreground/70"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({
  isFiltered,
  totalCount,
}: Readonly<{ isFiltered: boolean; totalCount: number }>) {
  if (isFiltered) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No discussions match this filter.
      </p>
    );
  }
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
        <MessagesSquare
          className="size-6"
          style={{ color: "var(--discussion-accent)" }}
          aria-hidden
        />
        <p className="text-sm font-medium">No discussions yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Discussions are for the open-ended questions that don&apos;t fit
          a single correction — intention, quality, alternative
          approaches. Anyone on the team can start one.
        </p>
      </div>
    );
  }
  return null;
}

"use client";

import { MessagesSquare } from "lucide-react";

import type { DiscussionItem } from "./types";

type DiscussionsSummaryProps = {
  discussions: DiscussionItem[];
};

/**
 * Lightweight header above the discussions list. Returns `null` when
 * there are no discussions — the empty state lives inside the list card
 * itself, not here. Mirrors the role of `<NotesSummary />` but doesn't
 * render a progress spine (discussions have no status pipeline).
 */
export function DiscussionsSummary({
  discussions,
}: Readonly<DiscussionsSummaryProps>) {
  if (discussions.length === 0) return null;

  const distinctAuthors = new Set(discussions.map((d) => d.author.id)).size;
  const voiceCount = discussions.filter((d) => d.noteType === "VOICE").length;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor:
          "color-mix(in oklch, var(--discussion-accent) 8%, var(--card))",
        borderColor:
          "color-mix(in oklch, var(--discussion-accent) 22%, transparent)",
      }}
    >
      <MessagesSquare
        className="size-3.5"
        style={{ color: "var(--discussion-accent)" }}
        aria-hidden
      />
      <span className="font-medium text-foreground">
        {discussions.length}{" "}
        {discussions.length === 1 ? "discussion" : "discussions"}
      </span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <span className="text-muted-foreground">
        Started by {distinctAuthors}{" "}
        {distinctAuthors === 1 ? "person" : "people"}
      </span>
      {voiceCount > 0 ? (
        <>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span className="text-muted-foreground">
            {voiceCount} voice
          </span>
        </>
      ) : null}
    </div>
  );
}

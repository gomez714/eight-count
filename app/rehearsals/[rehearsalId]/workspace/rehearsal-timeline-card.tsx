"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { NoteItem } from "./types";
import { clamp, formatTimestamp } from "./utils";

const DENSITY_BUCKETS = 48;
const TICK_COUNT = 5;

type RehearsalTimelineCardProps = {
  timelineRef: RefObject<HTMLDivElement | null>;
  currentPlaybackMs: number;
  videoDurationMs: number;
  notes: NoteItem[];
  onJumpToTimestamp: (timestampMs: number) => void;
  onTimelinePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTimelinePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTimelinePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function RehearsalTimelineCard({
  timelineRef,
  currentPlaybackMs,
  videoDurationMs,
  notes,
  onJumpToTimestamp,
  onTimelinePointerDown,
  onTimelinePointerMove,
  onTimelinePointerEnd,
}: RehearsalTimelineCardProps) {
  const playheadPercent =
    videoDurationMs > 0
      ? clamp((currentPlaybackMs / videoDurationMs) * 100, 0, 100)
      : 0;

  // Density strip — count notes per bucket and normalize.
  const densityHeights = useMemo(() => {
    const counts = Array.from({ length: DENSITY_BUCKETS }, () => 0);
    if (videoDurationMs <= 0) return counts;
    for (const note of notes) {
      const idx = Math.min(
        DENSITY_BUCKETS - 1,
        Math.floor((note.startTimestampMs / videoDurationMs) * DENSITY_BUCKETS)
      );
      counts[idx] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c) => c / max);
  }, [notes, videoDurationMs]);

  // Evenly-spaced tick labels.
  const tickLabels = useMemo(() => {
    if (videoDurationMs <= 0) return [];
    const result: string[] = [];
    for (let i = 0; i < TICK_COUNT; i++) {
      const ms = Math.round((videoDurationMs * i) / (TICK_COUNT - 1));
      result.push(formatTimestamp(ms));
    }
    return result;
  }, [videoDurationMs]);

  const isReady = videoDurationMs > 0;

  return (
    <Card className="gap-3 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
            Timeline
          </span>
          <span className="text-xs text-muted-foreground">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
            {isReady ? (
              <>
                {" "}across{" "}
                <span className="font-mono text-foreground">
                  {formatTimestamp(videoDurationMs)}
                </span>
              </>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: "var(--primary)" }}
            />
            Text
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: "var(--note-voice-accent)" }}
            />
            Voice
          </span>
        </div>
      </div>

      <div className="px-4">
        {/* Density strip — bars use the same 0-100% coordinate system as the
            markers below so each bucket lines up with notes at that time. */}
        <div aria-hidden className="relative h-[18px]">
          {densityHeights.map((value, i) => {
            const left = (i / DENSITY_BUCKETS) * 100
            const width = 100 / DENSITY_BUCKETS
            return (
              <span
                key={i}
                className={cn(
                  "absolute bottom-0 rounded-[1px]",
                  value > 0 ? "" : "opacity-60"
                )}
                style={{
                  left: `${left}%`,
                  width: `calc(${width}% - 1.5px)`,
                  height: `${Math.max(8, value * 100)}%`,
                  backgroundColor:
                    value > 0
                      ? "color-mix(in oklch, var(--primary) 28%, var(--muted))"
                      : "var(--muted)",
                }}
              />
            )
          })}
        </div>

        {/* Track + markers + playhead */}
        <div
          ref={timelineRef}
          className="relative mt-2 h-5 cursor-pointer touch-none select-none"
          onPointerDown={onTimelinePointerDown}
          onPointerMove={onTimelinePointerMove}
          onPointerUp={onTimelinePointerEnd}
          onPointerCancel={onTimelinePointerEnd}
        >
          <div
            aria-hidden
            className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-muted"
          >
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                width: `${playheadPercent}%`,
                backgroundColor: "var(--primary)",
                opacity: 0.4,
              }}
            />
          </div>

          {notes.map((note) => {
            if (!isReady) return null;
            const left = clamp(
              (note.startTimestampMs / videoDurationMs) * 100,
              0,
              100
            );
            const isVoice = note.noteType === "VOICE";
            const summary = isVoice
              ? `Voice note (${note.audioAsset?.durationMs ? formatTimestamp(note.audioAsset.durationMs) : "—"})`
              : (note.bodyText ?? "");

            return (
              <button
                key={note.id}
                type="button"
                title={`${formatTimestamp(note.startTimestampMs)} — ${summary}`}
                aria-label={`Jump to note at ${formatTimestamp(note.startTimestampMs)}`}
                className="absolute top-1/2 size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-[3px] border-2 shadow-sm transition-transform hover:scale-110"
                style={{
                  left: `${left}%`,
                  backgroundColor: isVoice
                    ? "var(--note-voice-accent)"
                    : "var(--primary)",
                  borderColor: "var(--card)",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onJumpToTimestamp(note.startTimestampMs);
                }}
              />
            );
          })}

          <span
            aria-hidden
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>

        {/* Time ticks */}
        {tickLabels.length > 0 ? (
          <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted-foreground">
            {tickLabels.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

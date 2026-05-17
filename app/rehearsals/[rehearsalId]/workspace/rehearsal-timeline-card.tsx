"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { clamp, formatTimestamp } from "./utils";

const DENSITY_BUCKETS = 48;
const TICK_COUNT = 5;

/**
 * Generic timeline marker — minimal shape so notes and discussions can
 * both feed the timeline. The accent palette switches based on
 * `accentTone`: notes use teal/coral (text/voice); discussions use the
 * `--discussion-accent` family.
 */
export type TimelineMarker = {
  id: string;
  startTimestampMs: number;
  /** "TEXT" or "VOICE" — drives marker color within the active palette. */
  mediaType: "TEXT" | "VOICE";
  /** Tooltip body — already-formatted preview of the marker's content. */
  summary: string;
};

export type TimelineAccentTone = "notes" | "discussions";

type AccentColors = {
  text: string;
  voice: string;
  density: string;
  textLabel: string;
  voiceLabel: string;
};

const ACCENT_COLORS: Record<TimelineAccentTone, AccentColors> = {
  notes: {
    text: "var(--primary)",
    voice: "var(--note-voice-accent)",
    density: "color-mix(in oklch, var(--primary) 28%, var(--muted))",
    textLabel: "Text",
    voiceLabel: "Voice",
  },
  discussions: {
    text: "var(--discussion-accent)",
    voice: "var(--note-voice-accent)",
    density: "color-mix(in oklch, var(--discussion-accent) 28%, var(--muted))",
    textLabel: "Text",
    voiceLabel: "Voice",
  },
};

type RehearsalTimelineCardProps = {
  timelineRef: RefObject<HTMLDivElement | null>;
  currentPlaybackMs: number;
  videoDurationMs: number;
  markers: TimelineMarker[];
  /** Accent palette + label noun. Defaults to the note palette. */
  accentTone?: TimelineAccentTone;
  /**
   * Singular / plural noun shown in the count line ("3 notes across 1:23").
   * Defaults to ["note", "notes"]. Discussions pass ["discussion", "discussions"].
   */
  countNoun?: [string, string];
  onJumpToTimestamp: (timestampMs: number) => void;
  onTimelinePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTimelinePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTimelinePointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function RehearsalTimelineCard({
  timelineRef,
  currentPlaybackMs,
  videoDurationMs,
  markers,
  accentTone = "notes",
  countNoun = ["note", "notes"],
  onJumpToTimestamp,
  onTimelinePointerDown,
  onTimelinePointerMove,
  onTimelinePointerEnd,
}: Readonly<RehearsalTimelineCardProps>) {
  const accent = ACCENT_COLORS[accentTone];
  const [singular, plural] = countNoun;

  const playheadPercent =
    videoDurationMs > 0
      ? clamp((currentPlaybackMs / videoDurationMs) * 100, 0, 100)
      : 0;

  // Density strip — count markers per bucket and normalize.
  const densityHeights = useMemo(() => {
    const counts = Array.from({ length: DENSITY_BUCKETS }, () => 0);
    if (videoDurationMs <= 0) return counts;
    for (const marker of markers) {
      const idx = Math.min(
        DENSITY_BUCKETS - 1,
        Math.floor((marker.startTimestampMs / videoDurationMs) * DENSITY_BUCKETS)
      );
      counts[idx] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c) => c / max);
  }, [markers, videoDurationMs]);

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
            {markers.length} {markers.length === 1 ? singular : plural}
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
              style={{ backgroundColor: accent.text }}
            />
            {accent.textLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: accent.voice }}
            />
            {accent.voiceLabel}
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
                  backgroundColor: value > 0 ? accent.density : "var(--muted)",
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

          {markers.map((marker) => {
            if (!isReady) return null;
            const left = clamp(
              (marker.startTimestampMs / videoDurationMs) * 100,
              0,
              100
            );
            const isVoice = marker.mediaType === "VOICE";

            return (
              <button
                key={marker.id}
                type="button"
                title={`${formatTimestamp(marker.startTimestampMs)} — ${marker.summary}`}
                aria-label={`Jump to ${singular} at ${formatTimestamp(marker.startTimestampMs)}`}
                className="absolute top-1/2 size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-[3px] border-2 shadow-sm transition-transform hover:scale-110"
                style={{
                  left: `${left}%`,
                  backgroundColor: isVoice ? accent.voice : accent.text,
                  borderColor: "var(--card)",
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onJumpToTimestamp(marker.startTimestampMs);
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

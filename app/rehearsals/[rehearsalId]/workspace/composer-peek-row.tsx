"use client";

import { ChevronUp, Clock, FileText, Mic } from "lucide-react";

import { cn } from "@/lib/utils";

import type { AudienceSummary, ComposerMode } from "./composer-body";
import { formatTimestamp } from "./utils";

type ComposerPeekRowProps = {
  mode: ComposerMode;
  onModeChange: (next: ComposerMode) => void;
  selectedTimestampMs: number;
  /**
   * When false, the timestamp pill is omitted entirely — there's no
   * video to anchor against. Defaults to true to preserve the existing
   * behavior at every existing call site.
   */
  hasVideo?: boolean;
  /**
   * Audience chip is note-specific. Discussions don't target individuals
   * (everyone in the team sees them), so the discussion peek row passes
   * `null` and we omit the chip entirely.
   */
  audienceSummary: AudienceSummary | null;
  /** Only meaningful when `audienceSummary` is non-null. */
  onTapAudience?: () => void;
  onCaptureTimestamp: () => void;
  onExpand: () => void;
  /** Override the right-side hint. Defaults to `Tap to write/record…`. */
  expandLabelOverride?: (mode: ComposerMode) => string;
  disabled: boolean;
};

// Buttons in the peek row use h-9 (36px) — larger than the desktop sub-bar's
// h-7 because thumb taps need more vertical room than mouse clicks. Still
// fits comfortably inside the 80px peek snap with the drag handle above.
export function ComposerPeekRow({
  mode,
  onModeChange,
  selectedTimestampMs,
  hasVideo = true,
  audienceSummary,
  onCaptureTimestamp,
  onTapAudience,
  onExpand,
  expandLabelOverride,
  disabled,
}: Readonly<ComposerPeekRowProps>) {
  const expandLabel =
    expandLabelOverride?.(mode) ??
    `Tap to ${mode === "VOICE" ? "record" : "write"}…`;
  return (
    <div className="flex items-center gap-2 px-3 pb-3">
      <div
        className="inline-flex shrink-0 gap-0.5 rounded-md border bg-card p-0.5"
        role="tablist"
        aria-label="Note type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "TEXT"}
          aria-label="Text note"
          onClick={() => onModeChange("TEXT")}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors",
            mode === "TEXT"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="size-4" />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "VOICE"}
          aria-label="Voice note"
          onClick={() => onModeChange("VOICE")}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors",
            mode === "VOICE"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Mic className="size-4" />
        </button>
      </div>

      {hasVideo ? (
        <button
          type="button"
          onClick={onCaptureTimestamp}
          disabled={disabled}
          title="Tap to update to the current video time"
          aria-label={`Note appears at ${formatTimestamp(selectedTimestampMs)}. Tap to update.`}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-transparent px-2 font-mono text-xs text-muted-foreground hover:border-border hover:bg-card disabled:opacity-50"
        >
          <Clock className="size-3.5" />
          <span className="font-semibold text-foreground">
            {formatTimestamp(selectedTimestampMs)}
          </span>
        </button>
      ) : null}

      {audienceSummary ? (
        <button
          type="button"
          onClick={onTapAudience}
          aria-label={`Audience: ${audienceSummary.label}. Tap to change.`}
          className="inline-flex h-9 min-w-0 shrink items-center gap-1 rounded-full border bg-card px-2.5 text-xs font-medium hover:bg-accent"
        >
          {audienceSummary.icon}
          <span className="min-w-0 truncate">{audienceSummary.label}</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onExpand}
        className="ml-auto inline-flex h-9 min-w-0 flex-1 items-center justify-end gap-1 truncate rounded-md text-xs text-muted-foreground hover:text-foreground"
      >
        <span className="truncate">{expandLabel}</span>
        <ChevronUp className="size-4 shrink-0 opacity-60" />
      </button>
    </div>
  );
}

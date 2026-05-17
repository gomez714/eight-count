import { Play } from "lucide-react";
import type { CSSProperties } from "react";

import { formatNoteTimestamp } from "@/lib/notes/format";
import { cn } from "@/lib/utils";

type NoteType = "TEXT" | "VOICE";

/**
 * Tone selects the accent palette family. `"note"` (default) keeps the
 * existing behavior (teal for TEXT, coral for VOICE). `"discussion"`
 * swaps the TEXT accent to the discussion indigo while keeping VOICE
 * coral (voice is voice — same accent regardless of host entity).
 */
export type TimestampPillTone = "note" | "discussion";

type NoteTimestampPillProps = {
  timestampMs: number;
  noteType?: NoteType;
  tone?: TimestampPillTone;
  /** When set, the pill becomes a button. */
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

const ACCENT_BY_TONE_AND_TYPE: Record<
  TimestampPillTone,
  Record<NoteType, string>
> = {
  note: {
    TEXT: "var(--primary)",
    VOICE: "var(--note-voice-accent)",
  },
  discussion: {
    TEXT: "var(--discussion-accent)",
    VOICE: "var(--note-voice-accent)",
  },
};

export function NoteTimestampPill({
  timestampMs,
  noteType = "TEXT",
  tone = "note",
  onClick,
  className,
  ariaLabel,
}: Readonly<NoteTimestampPillProps>) {
  const accent = ACCENT_BY_TONE_AND_TYPE[tone][noteType];
  const style: CSSProperties = {
    color: accent,
    backgroundColor: `color-mix(in oklch, ${accent} 10%, transparent)`,
  };

  const content = (
    <>
      <Play aria-hidden className="size-2.5 fill-current" strokeWidth={0} />
      <span className="font-mono text-xs font-semibold tabular-nums">
        {formatNoteTimestamp(timestampMs)}
      </span>
    </>
  );

  const baseClass = cn(
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `Jump to ${formatNoteTimestamp(timestampMs)}`}
        className={cn(
          baseClass,
          "border border-transparent outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring"
        )}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={baseClass} style={style}>
      {content}
    </span>
  );
}

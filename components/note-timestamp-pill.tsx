import { Play } from "lucide-react";
import type { CSSProperties } from "react";

import { formatNoteTimestamp } from "@/lib/notes/format";
import { cn } from "@/lib/utils";

type NoteType = "TEXT" | "VOICE";

type NoteTimestampPillProps = {
  timestampMs: number;
  noteType?: NoteType;
  /** When set, the pill becomes a button. */
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
};

const ACCENT_BY_TYPE: Record<NoteType, string> = {
  TEXT: "var(--primary)",
  VOICE: "var(--note-voice-accent)",
};

export function NoteTimestampPill({
  timestampMs,
  noteType = "TEXT",
  onClick,
  className,
  ariaLabel,
}: Readonly<NoteTimestampPillProps>) {
  const accent = ACCENT_BY_TYPE[noteType];
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

import { Repeat } from "lucide-react";

import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

type RepeatingChipProps = {
  tag: NoteTag;
  count: number;
  size?: "xs" | "sm";
  className?: string;
  /**
   * When true, renders just the icon + count without the tag label —
   * used in dense layouts where the tag is already shown adjacently.
   */
  compact?: boolean;
};

export function RepeatingChip({
  tag,
  count,
  size = "xs",
  compact = false,
  className,
}: Readonly<RepeatingChipProps>) {
  const label = compact
    ? `Repeating × ${count}`
    : `Repeating · ${NOTE_TAG_LABELS[tag]} × ${count}`;
  const ariaLabel = `Repeating: ${count} unresolved ${NOTE_TAG_LABELS[tag]} notes`;
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        backgroundColor: "var(--repeating-bg)",
        color: "var(--repeating-fg)",
        borderColor: "var(--repeating-border)",
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Repeat aria-hidden className="size-3" />
      {label}
    </span>
  );
}

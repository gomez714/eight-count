import { Tag as TagIcon } from "lucide-react";

import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

type TagChipProps = {
  tag: NoteTag;
  size?: "xs" | "sm";
  className?: string;
};

export function TagChip({ tag, size = "xs", className }: Readonly<TagChipProps>) {
  return (
    <span
      role="img"
      aria-label={`Tag: ${NOTE_TAG_LABELS[tag]}`}
      className={cn(
        "tag-chip inline-flex items-center gap-1 rounded-full border border-border bg-muted font-medium text-muted-foreground",
        size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <TagIcon aria-hidden className="size-2.5" />
      {NOTE_TAG_LABELS[tag]}
    </span>
  );
}

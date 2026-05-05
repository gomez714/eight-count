import type { ReactNode } from "react";

import { RepeatingChip } from "@/components/repeating-chip";
import { TagChip } from "@/components/tag-chip";
import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

type DrillTagSectionProps = {
  tag: NoteTag | null;
  itemCount: number;
  /** When set, renders a `RepeatingChip` next to the tag header. */
  repeatingCount?: number;
  /**
   * Visual variant. `card` adds bg-card and a stronger border (used on
   * the my-notes drill view, where each tag is its own card). `inline`
   * is borderless (used inside the per-dancer cards on the project page).
   */
  variant?: "card" | "inline";
  children: ReactNode;
};

export function DrillTagSection({
  tag,
  itemCount,
  repeatingCount,
  variant = "card",
  children,
}: Readonly<DrillTagSectionProps>) {
  return (
    <section
      className={cn(
        "drill-tag-section flex flex-col gap-2",
        variant === "card" && "rounded-lg border bg-card p-4",
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-center gap-2",
          variant === "card" && "border-b border-dashed border-border pb-2",
        )}
      >
        {tag ? (
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <TagChip tag={tag} size="sm" />
            <span>{NOTE_TAG_LABELS[tag]}</span>
          </h3>
        ) : (
          <h3 className="text-sm font-semibold text-muted-foreground">
            Other (untagged)
          </h3>
        )}
        {repeatingCount && tag ? (
          <RepeatingChip tag={tag} count={repeatingCount} compact />
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? "note" : "notes"}
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

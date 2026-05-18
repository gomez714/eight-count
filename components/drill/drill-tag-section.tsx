import type { ReactNode } from "react";

import { ExpandableRepeatingChip } from "@/components/expandable-repeating-chip";
import { RepeatingChip } from "@/components/repeating-chip";
import { TagChip } from "@/components/tag-chip";
import type { RepeatingClusterDetail } from "@/lib/notes/repeating";
import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

type DrillTagSectionProps = {
  tag: NoteTag | null;
  itemCount: number;
  /** When set, renders a `RepeatingChip` next to the tag header. */
  repeatingCount?: number;
  /**
   * When set, the header chip becomes an `<ExpandableRepeatingChip>`
   * that opens an inline detail panel below — timestamps + most-recent
   * body + source link. Requires a parent
   * `<RepeatingClusterExpansionProvider>` for the mobile single-open /
   * desktop multi-open coordination to apply; falls back to local state
   * otherwise.
   *
   * When `repeatingDetail` is set, `repeatingCount` is ignored (the
   * count comes from `repeatingDetail.count`).
   */
  repeatingDetail?: RepeatingClusterDetail;
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
  repeatingDetail,
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
        {renderHeaderChip(tag, repeatingDetail, repeatingCount)}
        <span className="ml-auto text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? "note" : "notes"}
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

function renderHeaderChip(
  tag: NoteTag | null,
  detail: RepeatingClusterDetail | undefined,
  count: number | undefined,
): ReactNode {
  if (!tag) return null;
  if (detail) return <ExpandableRepeatingChip detail={detail} compact />;
  if (count) return <RepeatingChip tag={tag} count={count} compact />;
  return null;
}

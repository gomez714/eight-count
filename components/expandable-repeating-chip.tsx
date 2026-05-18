"use client";

import { ChevronDown, Repeat } from "lucide-react";
import { useId, useState } from "react";

import { NOTE_TAG_LABELS } from "@/lib/notes/tags";
import type { RepeatingClusterDetail } from "@/lib/notes/repeating";
import { cn } from "@/lib/utils";

import { useRepeatingClusterExpansion } from "./repeating-cluster-expansion-context";
import { RepeatingClusterDetails } from "./repeating-cluster-details";

type ExpandableRepeatingChipProps = {
  detail: RepeatingClusterDetail;
  /**
   * `compact` matches the presentational `<RepeatingChip>` prop —
   * shows just `Repeating × N` without the tag label. Used in dense
   * layouts where the tag chip already sits adjacent.
   */
  compact?: boolean;
  size?: "xs" | "sm";
  className?: string;
};

/**
 * Interactive chip wrapper. Renders the same visual shape as
 * `<RepeatingChip>` but as a `<button>` that toggles an inline detail
 * panel below.
 *
 * Expansion state is coordinated by
 * `<RepeatingClusterExpansionProvider>` when one is mounted above
 * (gives you "one panel on mobile, many on desktop" behavior across all
 * chips in the surface). When no provider is mounted, falls back to
 * local `useState` so the chip still works standalone.
 *
 * Built as a wrapper around the same visual recipe as `<RepeatingChip>`
 * rather than extending it with a mode prop — keeps the presentational
 * primitive untouched and side-effect free.
 */
export function ExpandableRepeatingChip({
  detail,
  compact = false,
  size = "xs",
  className,
}: Readonly<ExpandableRepeatingChipProps>) {
  const coordinator = useRepeatingClusterExpansion();
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = coordinator
    ? coordinator.isExpanded(detail.key)
    : localExpanded;
  const setExpanded = (next: boolean) => {
    if (coordinator) {
      coordinator.setExpanded(detail.key, next);
    } else {
      setLocalExpanded(next);
    }
  };

  const panelId = useId();
  const label = compact
    ? `Repeating × ${detail.count}`
    : `Repeating · ${NOTE_TAG_LABELS[detail.tag]} × ${detail.count}`;
  const ariaLabel = expanded
    ? `Hide repeating-cluster details for ${NOTE_TAG_LABELS[detail.tag]}`
    : `Show repeating-cluster details for ${NOTE_TAG_LABELS[detail.tag]}: ${detail.count} unresolved notes`;

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={() => setExpanded(!expanded)}
        style={{
          backgroundColor: "var(--repeating-bg)",
          color: "var(--repeating-fg)",
          borderColor: "var(--repeating-border)",
        }}
        className={cn(
          "inline-flex w-fit cursor-pointer items-center gap-1 rounded-full border font-semibold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring",
          size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
          className,
        )}
      >
        <Repeat aria-hidden className="size-3" />
        {label}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3 transition-transform",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {expanded ? (
        <div id={panelId} className="w-full max-w-md">
          <RepeatingClusterDetails detail={detail} />
        </div>
      ) : null}
    </div>
  );
}

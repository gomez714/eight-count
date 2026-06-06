import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dedup placeholder rendered inline in the activity feed when the topmost
 * feed item IS the same note/discussion that's already shown in the
 * pinned Up Next card above. Preserves the recency truth (the activity
 * happened, we acknowledge it) without showing the same content twice.
 *
 * Tapping the row scroll-flashes the pinned card above via an anchor
 * link. The pin-card mounts `id="up-next"` so this navigation lands.
 */

type PinnedAboveMarkerProps = {
  /** Brief actor reference, e.g. "Maya's note" / "Talia's reply". */
  description: string;
  /** Relative age string, e.g. "5m". */
  age: string;
  className?: string;
};

export function PinnedAboveMarker({
  description,
  age,
  className,
}: Readonly<PinnedAboveMarkerProps>) {
  return (
    <a
      href="#up-next"
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      style={{
        background: "color-mix(in oklch, var(--surface-sunken) 60%, transparent)",
        border: "1px dashed var(--border)",
      }}
    >
      <ArrowUp aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {description} — pinned to Up Next above
      </span>
      <span className="shrink-0 font-mono text-[11px]">{age}</span>
    </a>
  );
}

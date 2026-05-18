import { ListChecks } from "lucide-react";
import Link from "next/link";

type DrillFromRehearsalButtonProps = {
  rehearsalId: string;
};

/**
 * Deep-links to `/my-notes?view=drill&rehearsal=<id>` — the personal drill
 * inbox pre-scoped to this rehearsal. Rendered in the rehearsal context
 * bar's `actions` slot only when the viewer has ≥1 active assignment in
 * the rehearsal (count is computed server-side in the page entry); avoids
 * surfacing a button that lands on an empty state.
 */
export function DrillFromRehearsalButton({
  rehearsalId,
}: Readonly<DrillFromRehearsalButtonProps>) {
  return (
    <Link
      href={`/my-notes?view=drill&rehearsal=${rehearsalId}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ListChecks aria-hidden className="size-3.5" />
      Drill from this rehearsal
    </Link>
  );
}

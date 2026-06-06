import { Users } from "lucide-react";
import Link from "next/link";

/**
 * Muted "you're working solo" card for users whose only team is a
 * personal workspace (created by quick-start). Frames the solo state
 * as a deliberate choice — never as something to fix — and offers
 * creating a team as a peer option, not a CTA.
 *
 * Renders below the meta line and above the pin/feed in V2's normal
 * branch when `isPersonalOnly` fires from `dashboard-v2.tsx`. The
 * "Create a team" link anchors to the teams section where the
 * `NewTeamButton` (dialog trigger) already lives — so users don't
 * have to learn a new entry point.
 */

type PersonalWorkspaceCardProps = {
  /** Display name of the personal workspace (e.g. "Iris's Workspace"). */
  workspaceName: string;
};

export function PersonalWorkspaceCard({
  workspaceName,
}: Readonly<PersonalWorkspaceCardProps>) {
  return (
    <aside
      aria-label="Personal workspace info"
      className="flex items-start gap-3 rounded-xl border p-3"
      style={{
        background: "var(--surface-sunken)",
        borderColor: "var(--border)",
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "var(--surface-canvas)",
          color: "var(--muted-foreground)",
        }}
      >
        <Users className="h-3.5 w-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[13px] leading-snug text-muted-foreground">
          You&apos;re working solo in{" "}
          <span className="font-semibold text-foreground">{workspaceName}</span>
          {" "}— that&apos;s perfectly fine. When you want to bring in a cast or
          another instructor, you can turn this into a team.
        </p>
        <Link
          href="/dashboard#teams"
          className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ color: "var(--primary)" }}
        >
          <span aria-hidden>+</span>
          Create a team
        </Link>
      </div>
    </aside>
  );
}

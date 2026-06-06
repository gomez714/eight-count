import { Users } from "lucide-react";

import { NewTeamButton } from "./new-team-button";
import { TeamRow } from "./team-row";
import type { TeamRowData } from "./types";

type TeamsSectionProps = {
  teams: TeamRowData[];
  /**
   * V2 dashboard treatment — uses the small-caps eyebrow heading, drops
   * the helper line, and adds an anchor target (`id="teams"`) so the
   * meta-line's "N teams" link scrolls here. Visual contract for V1
   * (the original tile-style dashboard) is unchanged.
   */
  compact?: boolean;
};

export function TeamsSection({
  teams,
  compact = false,
}: Readonly<TeamsSectionProps>) {
  if (teams.length === 0) {
    return (
      <section
        id={compact ? "teams" : undefined}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-2">
          {compact ? (
            <CompactHeading />
          ) : (
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Your teams
            </h2>
          )}
        </div>
        <EmptyState />
      </section>
    );
  }

  return (
    <section
      id={compact ? "teams" : undefined}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        {compact ? (
          <CompactHeading />
        ) : (
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
              Your teams
            </h2>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Workspaces you&apos;re a member of.
            </p>
          </div>
        )}
        <NewTeamButton />
      </div>

      <div className="flex flex-col gap-2">
        {teams.map((team) => (
          <TeamRow key={team.id} team={team} />
        ))}
      </div>
    </section>
  );
}

function CompactHeading() {
  return (
    <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
      Your teams
    </h2>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card/50 px-6 py-10 text-center">
      <span
        aria-hidden
        className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Users className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">You&apos;re not in any teams yet</p>
        <p className="max-w-sm text-xs text-muted-foreground sm:text-sm">
          Create a team to start a workspace where you can leave feedback,
          manage rehearsals, and invite the rest of your cast.
        </p>
      </div>
      <NewTeamButton
        variant="default"
        size="default"
        label="Create your first team"
        navigateOnSuccess
      />
    </div>
  );
}

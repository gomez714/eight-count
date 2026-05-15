"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { AvatarInitials } from "@/components/avatar-initials";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { TeamSwitcherTeam } from "@/lib/teams/get-teams-for-user";

import { CreateTeamForm } from "@/app/dashboard/create-team-form";
import { RoleChip } from "@/app/teams/[teamId]/role-chip";

type TeamSwitcherProps = {
  teams: TeamSwitcherTeam[];
  currentTeamId: string | null;
};

/**
 * Derive the active team from the current pathname. The root layout (and
 * therefore `AppHeader`) is not re-rendered during client-side navigation
 * between sibling routes, so the server-resolved `currentTeamId` goes
 * stale the moment the user navigates within the SPA. Reading the
 * pathname client-side keeps the switcher's checked state truthful.
 *
 * - `/teams/[teamId]` — teamId is in the URL, use it.
 * - `/dashboard`, `/my-notes`, `/notes-by-me`, `/` — no active team.
 * - `/projects/[id]` and `/rehearsals/[id]` — team is opaque from the
 *   URL; fall back to whatever the server passed. Correct on full-page
 *   loads; may be stale if the user navigated client-side from one
 *   team's project to another's, but that's a much rarer flow than
 *   the switcher → team page path the user actually clicks.
 */
function deriveCurrentTeamId(
  pathname: string,
  fallback: string | null,
): string | null {
  const teamMatch = /^\/teams\/([^/]+)/.exec(pathname);
  if (teamMatch) return teamMatch[1];

  if (
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/my-notes") ||
    pathname.startsWith("/notes-by-me")
  ) {
    return null;
  }

  return fallback;
}

export function TeamSwitcher({
  teams,
  currentTeamId,
}: Readonly<TeamSwitcherProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const activeTeamId = deriveCurrentTeamId(pathname, currentTeamId);
  const currentTeam =
    activeTeamId === null
      ? null
      : (teams.find((team) => team.id === activeTeamId) ?? null);

  const triggerLabel = currentTeam?.name ?? "Switch team";

  const handleCreateSuccess = ({ teamId }: { teamId: string }) => {
    setCreateOpen(false);
    setPopoverOpen(false);
    router.push(`/teams/${teamId}`);
    router.refresh();
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Switch team"
            className={cn(
              "inline-flex h-9 max-w-56 items-center gap-2 rounded-md border bg-card px-2.5 text-sm font-medium",
              "hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
              "transition-colors"
            )}
          >
            {currentTeam ? (
              <AvatarInitials
                name={currentTeam.name}
                toneSeed={currentTeam.id}
                size={20}
              />
            ) : (
              <span
                aria-hidden
                className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
              >
                ·
              </span>
            )}
            <span className="min-w-0 truncate">{triggerLabel}</span>
            {currentTeam ? (
              <RoleChip role={currentTeam.role} className="hidden sm:inline-flex" />
            ) : null}
            <ChevronsUpDown
              aria-hidden
              className="ml-0.5 size-3.5 shrink-0 text-muted-foreground"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-72 p-0"
        >
          <div className="px-3 pt-3 pb-2">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Switch team
            </p>
          </div>

          {teams.length === 0 ? (
            <div className="px-3 pb-3 text-sm text-muted-foreground">
              You aren&apos;t in any teams yet.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto px-1 pb-1">
              {teams.map((team) => {
                const isCurrent = team.id === activeTeamId;
                return (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.id}`}
                      onClick={() => setPopoverOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm",
                        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                        isCurrent && "bg-accent/60"
                      )}
                    >
                      <AvatarInitials
                        name={team.name}
                        toneSeed={team.id}
                        size={22}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {team.name}
                      </span>
                      <RoleChip role={team.role} />
                      <Check
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 text-foreground",
                          isCurrent ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t">
            <button
              type="button"
              onClick={() => {
                setPopoverOpen(false);
                setCreateOpen(true);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium",
                "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              )}
            >
              <span
                aria-hidden
                className="inline-flex size-5 items-center justify-center rounded-full bg-foreground/5"
              >
                <Plus className="size-3.5" />
              </span>
              Create team
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>
              Start a new workspace where you&apos;re the admin. You can invite
              members and create projects right after.
            </DialogDescription>
          </DialogHeader>

          <CreateTeamForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <span aria-live="polite" className="sr-only">
        {currentTeam ? `Current team: ${currentTeam.name}` : ""}
      </span>
    </>
  );
}

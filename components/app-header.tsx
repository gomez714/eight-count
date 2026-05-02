import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import Link from "next/link";

import { TeamSwitcher } from "@/components/team-switcher";
import { getCurrentDbUser } from "@/lib/auth/get-current-db-user";
import {
  getTeamsForUser,
  type TeamSwitcherTeam,
} from "@/lib/teams/get-teams-for-user";
import { resolveCurrentTeamId } from "@/lib/teams/resolve-current-team-id";

export async function AppHeader() {
  const { userId } = await auth();

  let teams: TeamSwitcherTeam[] = [];
  let currentTeamId: string | null = null;
  let isSignedIn = false;

  if (userId) {
    const dbUser = await getCurrentDbUser();
    if (dbUser) {
      isSignedIn = true;
      const headersList = await headers();
      const pathname = headersList.get("x-pathname") ?? "/";

      [teams, currentTeamId] = await Promise.all([
        getTeamsForUser(dbUser.id),
        resolveCurrentTeamId(pathname, dbUser.id),
      ]);
    }
  }

  return (
    <header className="flex h-[60px] items-center justify-between gap-4 border-b bg-card px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="inline-flex size-7 items-center justify-center rounded-md bg-foreground text-sm font-semibold tracking-tight text-background"
          >
            8
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Eight Count
          </span>
        </Link>

        {isSignedIn ? (
          <>
            <span aria-hidden className="text-muted-foreground/50">
              /
            </span>
            <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
          </>
        ) : null}
      </div>

      {isSignedIn ? (
        <UserButton />
      ) : (
        <div className="flex items-center gap-3">
          <SignInButton />
          <SignUpButton>
            <button
              type="button"
              className="cursor-pointer rounded-full bg-purple-700 px-4 py-2 text-sm font-medium text-white"
            >
              Sign Up
            </button>
          </SignUpButton>
        </div>
      )}
    </header>
  );
}

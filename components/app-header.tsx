import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

import { BrandLockup } from "@/components/brand-lockup";
import { TeamSwitcher } from "@/components/team-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentDbUser } from "@/lib/auth/get-current-db-user";
import {
  getTeamsForUser,
  type TeamSwitcherTeam,
} from "@/lib/teams/get-teams-for-user";
import { resolveCurrentTeamId } from "@/lib/teams/resolve-current-team-id";

export async function AppHeader() {
  // Landing page (`/`) renders its own marketing nav (`<LandingNav />`)
  // with anchor links + sign-in/up CTAs, so the global header is hidden
  // there. Every other route — signed-in or out — gets this header.
  // Signed-in users hitting `/` get redirected to `/dashboard` upstream
  // in app/page.tsx, so this only affects the public landing.
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";
  if (pathname === "/") {
    return null;
  }

  const { userId } = await auth();

  let teams: TeamSwitcherTeam[] = [];
  let currentTeamId: string | null = null;
  let isSignedIn = false;

  if (userId) {
    const dbUser = await getCurrentDbUser();
    if (dbUser) {
      isSignedIn = true;

      [teams, currentTeamId] = await Promise.all([
        getTeamsForUser(dbUser.id),
        resolveCurrentTeamId(pathname, dbUser.id),
      ]);
    }
  }

  return (
    <header className="flex h-[60px] items-center justify-between gap-4 border-b bg-card px-6">
      <div className="flex min-w-0 items-center gap-3">
        <BrandLockup size="sm" href={isSignedIn ? "/dashboard" : "/"} />

        {isSignedIn ? (
          <>
            <span aria-hidden className="text-muted-foreground/50">
              /
            </span>
            <TeamSwitcher teams={teams} currentTeamId={currentTeamId} />
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {isSignedIn ? (
          <UserButton />
        ) : (
          <>
            {/* mode="redirect" sends users to our custom /sign-in and
                /sign-up routes (configured via NEXT_PUBLIC_CLERK_SIGN_IN_URL
                + NEXT_PUBLIC_CLERK_SIGN_UP_URL in .env). forceRedirectUrl
                guarantees the post-auth landing is /dashboard. */}
            <SignInButton mode="redirect" forceRedirectUrl="/dashboard" />
            <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
              <button
                type="button"
                className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                Sign Up
              </button>
            </SignUpButton>
          </>
        )}
      </div>
    </header>
  );
}

import { db } from "@/lib/db";

const TEAM_PATH = /^\/teams\/([^/]+)/;
const PROJECT_PATH = /^\/projects\/([^/]+)/;
const REHEARSAL_PATH = /^\/rehearsals\/([^/]+)/;

/**
 * Given a request pathname and the signed-in user, returns the teamId the
 * user is currently scoped to (if any). Used by the global header / team
 * switcher to highlight the active team.
 *
 * Membership is verified at the same time — if the user isn't a member of
 * the resolved team, returns null. That guarantees the switcher never lights
 * up a team the viewer can't access (even though they shouldn't reach those
 * routes anyway).
 *
 * Returns null on cross-team or unauth pages (`/dashboard`, `/my-notes`,
 * `/notes-by-me`, `/`, etc.).
 */
export async function resolveCurrentTeamId(
  pathname: string,
  userId: string
): Promise<string | null> {
  const teamMatch = TEAM_PATH.exec(pathname);
  if (teamMatch) {
    const teamId = teamMatch[1];
    const member = await db.teamMember.findFirst({
      where: { teamId, userId },
      select: { teamId: true },
    });
    return member?.teamId ?? null;
  }

  const projectMatch = PROJECT_PATH.exec(pathname);
  if (projectMatch) {
    const project = await db.project.findFirst({
      where: {
        id: projectMatch[1],
        team: { members: { some: { userId } } },
      },
      select: { teamId: true },
    });
    return project?.teamId ?? null;
  }

  const rehearsalMatch = REHEARSAL_PATH.exec(pathname);
  if (rehearsalMatch) {
    const rehearsal = await db.rehearsal.findFirst({
      where: {
        id: rehearsalMatch[1],
        project: { team: { members: { some: { userId } } } },
      },
      select: { project: { select: { teamId: true } } },
    });
    return rehearsal?.project.teamId ?? null;
  }

  return null;
}

import "server-only";

import { db } from "@/lib/db";

const TEAM_PATH = /^\/teams\/([^/?#]+)/;
const PROJECT_PATH = /^\/projects\/([^/?#]+)/;
const REHEARSAL_PATH = /^\/rehearsals\/([^/?#]+)/;

export type FeedbackContext = {
  teamId: string | null;
  projectId: string | null;
  rehearsalId: string | null;
};

/**
 * Given the page URL the user submitted feedback from + their userId,
 * resolve which team/project/rehearsal (if any) to attach to the row.
 *
 * Membership is verified at the same time — IDs are only attached when
 * the user is actually a member of the owning team. This is the
 * load-bearing piece: never trust client-attached IDs because a
 * compromised client could otherwise pin feedback to teams the user
 * doesn't belong to (poisoning the admin inbox or the team's history).
 *
 * Same architectural pattern as `resolveCurrentTeamId` in
 * [lib/teams/resolve-current-team-id.ts] — extended to also resolve the
 * project and rehearsal anchors when the URL exposes them.
 *
 * Returns `{ null, null, null }` on cross-team pages (`/dashboard`,
 * `/my-notes`, etc.), unauth pages, or any URL the user can't reach.
 */
export async function resolveFeedbackContext(
  pageUrl: string,
  userId: string
): Promise<FeedbackContext> {
  const empty: FeedbackContext = {
    teamId: null,
    projectId: null,
    rehearsalId: null,
  };

  const rehearsalMatch = REHEARSAL_PATH.exec(pageUrl);
  if (rehearsalMatch) {
    const rehearsal = await db.rehearsal.findFirst({
      where: {
        id: rehearsalMatch[1],
        project: { team: { members: { some: { userId } } } },
      },
      select: {
        id: true,
        projectId: true,
        project: { select: { teamId: true } },
      },
    });
    if (!rehearsal) return empty;
    return {
      teamId: rehearsal.project.teamId,
      projectId: rehearsal.projectId,
      rehearsalId: rehearsal.id,
    };
  }

  const projectMatch = PROJECT_PATH.exec(pageUrl);
  if (projectMatch) {
    const project = await db.project.findFirst({
      where: {
        id: projectMatch[1],
        team: { members: { some: { userId } } },
      },
      select: { id: true, teamId: true },
    });
    if (!project) return empty;
    return {
      teamId: project.teamId,
      projectId: project.id,
      rehearsalId: null,
    };
  }

  const teamMatch = TEAM_PATH.exec(pageUrl);
  if (teamMatch) {
    const member = await db.teamMember.findFirst({
      where: { teamId: teamMatch[1], userId },
      select: { teamId: true },
    });
    return {
      teamId: member?.teamId ?? null,
      projectId: null,
      rehearsalId: null,
    };
  }

  return empty;
}

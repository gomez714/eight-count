import type { TeamRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type TeamSwitcherTeam = {
  id: string;
  name: string;
  role: TeamRole;
};

export async function getTeamsForUser(
  userId: string
): Promise<TeamSwitcherTeam[]> {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { createdAt: "desc" },
  });

  return memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
    role: membership.role,
  }));
}

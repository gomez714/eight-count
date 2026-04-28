import { db } from "@/lib/db";

export async function getTeamForUser(teamId: string, userId: string) {
  return db.team.findFirst({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        where: {
          userId,
        },
      },
    },
  });
}
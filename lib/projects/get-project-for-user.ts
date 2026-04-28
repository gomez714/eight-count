import { db } from "@/lib/db";

export async function getProjectForUser(projectId: string, userId: string) {
  return db.project.findFirst({
    where: {
      id: projectId,
      team: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    include: {
      team: {
        include: {
          members: {
            where: {
              userId,
            },
          },
        },
      },
    },
  });
}
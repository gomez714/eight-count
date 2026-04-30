import { db } from "@/lib/db";

/**
 * Returns all ProjectGroups for a project, including each group's members
 * (via TeamMember -> User). Caller is expected to have already verified
 * the user has access to the project.
 */
export async function getProjectGroups(projectId: string) {
  return db.projectGroup.findMany({
    where: {
      projectId,
    },
    include: {
      members: {
        include: {
          teamMember: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export type ProjectGroupWithMembers = Awaited<
  ReturnType<typeof getProjectGroups>
>[number];

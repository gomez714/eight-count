import { db } from "@/lib/db";

/**
 * Active = OPEN or IN_PROGRESS, including the implicit OPEN
 * (NoteAssignmentStatus row absent → treat as OPEN).
 *
 * Returns one row per assignment with the fields needed for repeating-cluster
 * detection (`detectRepeatingClusters`) and the drill list rendering.
 */
export async function getActiveAssignmentsForProjects(projectIds: string[]) {
  if (projectIds.length === 0) return [];
  return db.noteAssignment.findMany({
    where: {
      note: {
        rehearsal: {
          projectId: { in: projectIds },
        },
      },
      OR: [
        { status: { is: null } },
        { status: { is: { status: "OPEN" } } },
        { status: { is: { status: "IN_PROGRESS" } } },
      ],
    },
    include: {
      user: true,
      status: true,
      note: {
        include: {
          audioAsset: true,
          rehearsal: {
            select: {
              id: true,
              projectId: true,
              title: true,
              rehearsalDate: true,
            },
          },
        },
      },
    },
  });
}

export type ActiveAssignmentRow = Awaited<
  ReturnType<typeof getActiveAssignmentsForProjects>
>[number];

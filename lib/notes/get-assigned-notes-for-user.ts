import { db } from "@/lib/db";

export async function getAssignedNotesForUser(userId: string) {
  return db.noteAssignment.findMany({
    where: {
      userId,
    },
    include: {
      status: true,
      note: {
        include: {
          author: true,
          audioAsset: true,
          targets: {
            include: {
              user: true,
              group: true,
            },
          },
          rehearsal: {
            include: {
              project: {
                include: {
                  team: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      {
        note: {
          startTimestampMs: "asc",
        },
      },
    ],
  });
}

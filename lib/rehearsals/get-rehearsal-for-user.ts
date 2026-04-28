import { db } from "@/lib/db";

export async function getRehearsalForUser(rehearsalId: string, userId: string) {
  return db.rehearsal.findFirst({
    where: {
      id: rehearsalId,
      project: {
        team: {
          members: {
            some: {
              userId,
            },
          },
        },
      },
    },
    include: {
      project: {
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
      },
      videoAsset: true,
      notes: {
        include: {
          author: true,
        },
        orderBy: {
          timestampMs: "asc",
        },
      },
    },
  });
}
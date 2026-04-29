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
                include: {
                  user: true,
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
          assignments: {
            include: {
              user: true,
              status: true,
            },
          },
        },
        orderBy: {
          timestampMs: "asc",
        },
      },
    },
  });
}
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
                // Only active team members — soft-deleted users
                // disappear from the audience picker but their
                // historical notes/assignments stay attributed
                // (see `notes.assignments.user` below — unfiltered).
                where: { user: { deletedAt: null } },
                include: {
                  user: true,
                },
              },
            },
          },
          groups: {
            include: {
              members: {
                include: {
                  teamMember: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
      videoAsset: true,
      notes: {
        include: {
          author: true,
          audioAsset: true,
          assignments: {
            include: {
              user: true,
              status: true,
            },
          },
          targets: {
            include: {
              user: true,
              group: true,
            },
          },
        },
        orderBy: {
          startTimestampMs: "asc",
        },
      },
    },
  });
}
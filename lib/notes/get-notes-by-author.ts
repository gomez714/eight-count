import { db } from "@/lib/db";

/**
 * Returns notes authored by the given user, with each note's per-recipient
 * NoteAssignments and audience NoteTargets included so the caller can
 * compute progress (e.g. "12 of 20 addressed") and render audience chips.
 */
export async function getNotesByAuthor(authorUserId: string) {
  return db.note.findMany({
    where: {
      authorUserId,
    },
    include: {
      author: true,
      audioAsset: true,
      targets: {
        include: {
          user: true,
          group: true,
        },
      },
      assignments: {
        include: {
          user: true,
          status: true,
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
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
  });
}

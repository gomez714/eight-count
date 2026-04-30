import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { getAssignedNotesForUser } from "@/lib/notes/get-assigned-notes-for-user";

import { MyNotesList } from "./my-notes-list";
import { NOTE_STATUSES, type AssignedNoteRow, type NoteStatus } from "./types";

export default async function MyNotesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await ensureDbUser();

  if (!dbUser) {
    redirect("/sign-in");
  }

  const assignments = await getAssignedNotesForUser(dbUser.id);

  const buckets: Record<NoteStatus, AssignedNoteRow[]> = {
    OPEN: [],
    IN_PROGRESS: [],
    ADDRESSED: [],
    RESOLVED: [],
  };

  for (const assignment of assignments) {
    const status = assignment.status?.status ?? "OPEN";

    buckets[status].push({
      id: assignment.id,
      status,
      note: {
        id: assignment.note.id,
        bodyText: assignment.note.bodyText,
        timestampMs: assignment.note.timestampMs,
        createdAt: assignment.note.createdAt,
        updatedAt: assignment.note.updatedAt,
        author: {
          id: assignment.note.author.id,
          name: assignment.note.author.name,
          email: assignment.note.author.email,
        },
        targets: assignment.note.targets.map((target) => ({
          id: target.id,
          kind: target.kind,
          user: target.user
            ? {
                id: target.user.id,
                name: target.user.name,
                email: target.user.email,
              }
            : null,
          group: target.group
            ? { id: target.group.id, name: target.group.name }
            : null,
        })),
        rehearsal: {
          id: assignment.note.rehearsal.id,
          title: assignment.note.rehearsal.title,
          rehearsalDate: assignment.note.rehearsal.rehearsalDate,
          project: {
            id: assignment.note.rehearsal.project.id,
            title: assignment.note.rehearsal.project.title,
            team: {
              id: assignment.note.rehearsal.project.team.id,
              name: assignment.note.rehearsal.project.team.name,
            },
          },
        },
      },
    });
  }

  const totalCount = NOTE_STATUSES.reduce(
    (sum, status) => sum + buckets[status].length,
    0
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">My notes</h1>
        <p className="text-sm text-muted-foreground">
          Feedback assigned to you across your rehearsals. Update the status as
          you work through each note.
        </p>
      </section>

      <MyNotesList buckets={buckets} totalCount={totalCount} />
    </main>
  );
}

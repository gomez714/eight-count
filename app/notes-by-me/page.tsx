import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { getNotesByAuthor } from "@/lib/notes/get-notes-by-author";

import { NotesByMeList } from "./notes-by-me-list";
import type { AuthoredNoteRow } from "./types";

export default async function NotesByMePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await ensureDbUser();

  if (!dbUser) {
    redirect("/sign-in");
  }

  const notes = await getNotesByAuthor(dbUser.id);

  const rows: AuthoredNoteRow[] = notes.map((note) => ({
    id: note.id,
    bodyText: note.bodyText,
    timestampMs: note.timestampMs,
    createdAt: note.createdAt,
    targets: note.targets.map((target) => ({
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
    assignments: note.assignments.map((assignment) => ({
      id: assignment.id,
      status: assignment.status?.status ?? "OPEN",
      user: {
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
      },
    })),
    rehearsal: {
      id: note.rehearsal.id,
      title: note.rehearsal.title,
      rehearsalDate: note.rehearsal.rehearsalDate,
      project: {
        id: note.rehearsal.project.id,
        title: note.rehearsal.project.title,
        team: {
          id: note.rehearsal.project.team.id,
          name: note.rehearsal.project.team.name,
        },
      },
    },
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Notes by me
        </h1>
        <p className="text-sm text-muted-foreground">
          Notes you&apos;ve authored, with progress across each recipient.
          Filter to see what&apos;s still outstanding.
        </p>
      </section>

      <NotesByMeList notes={rows} />
    </main>
  );
}

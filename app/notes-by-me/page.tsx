import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SectionTabNav } from "@/components/section-tab-nav";
import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { getNotesByAuthor } from "@/lib/notes/get-notes-by-author";
import { isNoteStalled } from "@/lib/notes/stalled";
import type { NoteStatus } from "@/lib/notes/statuses";

import { NotesByMeList } from "./notes-by-me-list";
import type { AuthoredAssignmentCounts, AuthoredNoteRow } from "./types";

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
  const stalledNow = new Date();

  const rows: AuthoredNoteRow[] = notes.map((note) => {
    const assignments = note.assignments.map((assignment) => ({
      id: assignment.id,
      status: (assignment.status?.status ?? "OPEN") as NoteStatus,
      user: {
        id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
      },
    }));

    const assignmentCounts: AuthoredAssignmentCounts = {
      OPEN: 0,
      IN_PROGRESS: 0,
      ADDRESSED: 0,
      RESOLVED: 0,
    };
    for (const assignment of assignments) {
      assignmentCounts[assignment.status] += 1;
    }

    return {
      id: note.id,
      noteType: note.noteType,
      bodyText: note.bodyText,
      startTimestampMs: note.startTimestampMs,
      endTimestampMs: note.endTimestampMs,
      audioAsset: note.audioAsset
        ? {
            id: note.audioAsset.id,
            mimeType: note.audioAsset.mimeType,
            durationMs: note.audioAsset.durationMs,
          }
        : null,
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
      assignments,
      assignmentCounts,
      stalled: isNoteStalled({
        createdAt: note.createdAt,
        assignments,
        now: stalledNow,
      }),
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
    };
  });

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <SectionTabNav active="notes-by-me" />

      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1.5 px-6 py-7">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Author dashboard
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            Notes by me
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Notes you&apos;ve authored, with progress across each recipient.
            Spot what&apos;s stalled and follow through.
          </p>
        </div>
      </div>

      <NotesByMeList notes={rows} />
    </main>
  );
}

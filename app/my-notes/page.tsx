import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SectionTabNav } from "@/components/section-tab-nav";
import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { getAssignedNotesForUser } from "@/lib/notes/get-assigned-notes-for-user";
import {
  isTipGroupDismissed,
  parseOnboardingState,
} from "@/lib/onboarding/state";

import { MyNotesList } from "./my-notes-list";
import type { AssignedNoteRow } from "./types";

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

  const myNotesTipsDismissed = isTipGroupDismissed(
    parseOnboardingState(dbUser.onboardingState),
    "myNotes"
  );

  const rows: AssignedNoteRow[] = assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status?.status ?? "OPEN",
    note: {
      id: assignment.note.id,
      noteType: assignment.note.noteType,
      bodyText: assignment.note.bodyText,
      startTimestampMs: assignment.note.startTimestampMs,
      endTimestampMs: assignment.note.endTimestampMs,
      audioAsset: assignment.note.audioAsset
        ? {
            id: assignment.note.audioAsset.id,
            mimeType: assignment.note.audioAsset.mimeType,
            durationMs: assignment.note.audioAsset.durationMs,
          }
        : null,
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
  }));

  return (
    <main className="min-h-[calc(100vh-60px)]">
      <SectionTabNav active="my-notes" />

      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1.5 px-6 py-7">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Inbox
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">My notes</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Feedback assigned to you across rehearsals. Update each note&apos;s
            status as you work through it.
          </p>
        </div>
      </div>

      <MyNotesList rows={rows} tipsDismissed={myNotesTipsDismissed} />
    </main>
  );
}

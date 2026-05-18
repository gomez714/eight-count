import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SectionTabNav } from "@/components/section-tab-nav";
import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { summarizeThread } from "@/lib/threads/comments";
import { getActiveAssignmentsForProjects } from "@/lib/notes/get-active-assignments-for-project";
import { getAssignedNotesForUser } from "@/lib/notes/get-assigned-notes-for-user";
import {
  buildRepeatingMarkerByAssignmentId,
  detectRepeatingClusters,
  type RepeatingClusterDetail,
  type RepeatingClusterDetailItem,
} from "@/lib/notes/repeating";
import {
  isTipGroupDismissed,
  parseOnboardingState,
} from "@/lib/onboarding/state";

import { MyNotesList } from "./my-notes-list";
import type { AssignedNoteRow } from "./types";

type MyNotesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MyNotesPage({
  searchParams,
}: Readonly<MyNotesPageProps>) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await ensureDbUser();

  if (!dbUser) {
    redirect("/sign-in");
  }

  const assignments = await getAssignedNotesForUser(dbUser.id);

  // ?rehearsal=<id> — set by the "Drill from this rehearsal" button on the
  // workspace. Initial filter only — the client owns the filter state after
  // mount and updates the URL when the user clears it.
  const params = await searchParams;
  const rehearsalParam = params.rehearsal;
  const initialRehearsalId =
    typeof rehearsalParam === "string" && rehearsalParam.length > 0
      ? rehearsalParam
      : null;

  const myNotesTipsDismissed = isTipGroupDismissed(
    parseOnboardingState(dbUser.onboardingState),
    "myNotes"
  );

  // Compute repeating clusters scoped to projects this user has notes in.
  // We need *all* of this user's active assignments across these projects
  // (not just open ones) so the threshold check is correct.
  const projectIds = Array.from(
    new Set(assignments.map((a) => a.note.rehearsal.project.id)),
  );
  const projectActive = await getActiveAssignmentsForProjects(projectIds);
  const myProjectClusters = detectRepeatingClusters(
    projectActive
      .filter((a) => a.userId === dbUser.id)
      .map((a) => ({
        id: a.id,
        userId: a.userId,
        projectId: a.note.rehearsal.projectId,
        tag: a.note.tag,
        status: a.status?.status ?? "OPEN",
      })),
  );
  const repeatingByAssignmentId = buildRepeatingMarkerByAssignmentId(
    myProjectClusters,
  );

  // Build the expandable cluster details for the chips in the drill view.
  // For `/my-notes` the cluster key is the tag alone — one viewer, so
  // tag is unique within the surface.
  const projectActiveById = new Map(projectActive.map((a) => [a.id, a]));
  const repeatingClusterDetails: RepeatingClusterDetail[] = myProjectClusters.map(
    (cluster) => {
      const items: RepeatingClusterDetailItem[] = [];
      for (const id of cluster.assignmentIds) {
        const a = projectActiveById.get(id);
        if (!a) continue;
        items.push({
          assignmentId: a.id,
          noteId: a.noteId,
          rehearsalId: a.note.rehearsal.id,
          rehearsalTitle: a.note.rehearsal.title,
          startTimestampMs: a.note.startTimestampMs,
          noteType: a.note.noteType,
          bodyText: a.note.bodyText,
          voiceTranscript:
            a.note.audioAsset?.transcriptStatus === "READY"
              ? (a.note.audioAsset.transcript ?? null)
              : null,
          audioDurationMs: a.note.audioAsset?.durationMs ?? null,
          createdAtMs: a.note.createdAt.getTime(),
        });
      }
      items.sort((x, y) => y.createdAtMs - x.createdAtMs);
      return {
        key: cluster.tag,
        tag: cluster.tag,
        count: cluster.count,
        items,
      };
    },
  );

  const rows: AssignedNoteRow[] = assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status?.status ?? "OPEN",
    repeating: repeatingByAssignmentId.get(assignment.id) ?? null,
    note: {
      id: assignment.note.id,
      noteType: assignment.note.noteType,
      bodyText: assignment.note.bodyText,
      startTimestampMs: assignment.note.startTimestampMs,
      endTimestampMs: assignment.note.endTimestampMs,
      tag: assignment.note.tag,
      audioAsset: assignment.note.audioAsset
        ? {
            id: assignment.note.audioAsset.id,
            mimeType: assignment.note.audioAsset.mimeType,
            durationMs: assignment.note.audioAsset.durationMs,
            transcript: assignment.note.audioAsset.transcript,
            transcriptStatus: assignment.note.audioAsset.transcriptStatus,
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
      thread: summarizeThread({
        viewerId: dbUser.id,
        comments: assignment.note.comments,
        reactions: assignment.note.reactions,
        lastViewedAt: assignment.note.threadViews[0]?.lastViewedAt ?? null,
      }),
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

      <MyNotesList
        rows={rows}
        tipsDismissed={myNotesTipsDismissed}
        viewerId={dbUser.id}
        initialRehearsalId={initialRehearsalId}
        repeatingClusterDetails={repeatingClusterDetails}
      />
    </main>
  );
}

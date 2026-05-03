import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { isNoteStalled } from "@/lib/notes/stalled";
import { isActiveStatus, type NoteStatus } from "@/lib/notes/statuses";
import {
  deriveChecklist,
  isChecklistStepKey,
  type ChecklistInputMembership,
  type ChecklistStepKey,
} from "@/lib/onboarding/derive-checklist";
import {
  isChecklistDismissed,
  parseOnboardingState,
} from "@/lib/onboarding/state";

import { DashboardMetaBand } from "./dashboard-meta-band";
import { OnboardingChecklist } from "./onboarding-checklist";
import { TeamsSection } from "./teams-section";
import type {
  MyNotesMetrics,
  NotesByMeMetrics,
  TeamRowData,
} from "./types";
import { WorkTiles } from "./work-tiles";

const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);

function pickFirstName(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await ensureDbUser();
  if (!dbUser) {
    redirect("/sign-in");
  }

  const [memberships, myAssignments, authoredNotes] = await Promise.all([
    db.teamMember.findMany({
      where: { userId: dbUser.id },
      include: {
        team: {
          include: {
            projects: {
              select: {
                id: true,
                rehearsals: {
                  orderBy: { rehearsalDate: "desc" },
                  take: 1,
                  select: { id: true, rehearsalDate: true },
                },
              },
            },
            // Used by the onboarding checklist to derive
            // "Invite a teammate" completion (any other member or any
            // invitation in a team the user admins).
            _count: {
              select: { members: true, invitations: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.noteAssignment.findMany({
      where: { userId: dbUser.id },
      select: {
        status: { select: { status: true } },
      },
    }),
    db.note.findMany({
      where: { authorUserId: dbUser.id },
      select: {
        createdAt: true,
        assignments: {
          select: {
            status: { select: { status: true } },
          },
        },
      },
    }),
  ]);

  // Per-team aggregation for the row cards.
  const teamRows: TeamRowData[] = memberships.map((membership) => {
    const projects = membership.team.projects;
    const rehearsalTimestamps = projects
      .map((project) => project.rehearsals[0]?.rehearsalDate?.getTime() ?? null)
      .filter((time): time is number => time !== null);
    const lastActivityAt =
      rehearsalTimestamps.length > 0
        ? new Date(Math.max(...rehearsalTimestamps))
        : null;

    return {
      id: membership.team.id,
      name: membership.team.name,
      role: membership.role,
      projectCount: projects.length,
      lastActivityAt,
      createdAt: membership.team.createdAt,
    };
  });

  // My-notes metrics: count active vs. total.
  const myNotes: MyNotesMetrics = {
    onPlate: myAssignments.filter((assignment) =>
      isActiveStatus(
        (assignment.status?.status ?? "OPEN") as NoteStatus
      )
    ).length,
    total: myAssignments.length,
  };

  // Notes-by-me metrics: total + stalled (per the same threshold used on /notes-by-me).
  const stalledNow = new Date();
  const notesByMe: NotesByMeMetrics = {
    total: authoredNotes.length,
    stalled: authoredNotes.filter((note) =>
      isNoteStalled({
        createdAt: note.createdAt,
        assignments: note.assignments.map((assignment) => ({
          status: (assignment.status?.status ?? "OPEN") as NoteStatus,
        })),
        now: stalledNow,
      })
    ).length,
  };

  // Only show "Notes by me" tile to users with at least one authoring-role
  // membership; pure dancers can't author notes so the tile is meaningless.
  const showNotesByMe = memberships.some((membership) =>
    AUTHOR_ROLES.has(membership.role)
  );

  const displayName = pickFirstName(dbUser.name);

  // Onboarding checklist: build the typed input from the data we already have.
  const checklistMemberships: ChecklistInputMembership[] = memberships.map(
    (m) => ({
      role: m.role,
      team: {
        id: m.team.id,
        projects: m.team.projects.map((p) => ({
          id: p.id,
          rehearsals: p.rehearsals.map((r) => ({ id: r.id })),
        })),
      },
    })
  );

  const hasInvitedOrSecondMember = memberships.some(
    (m) =>
      m.role === "ADMIN" &&
      // _count.members includes the viewer themselves, so >1 means at least one other member.
      (m.team._count.members > 1 || m.team._count.invitations > 0)
  );
  const hasAuthoredNote = authoredNotes.length > 0;
  const hasUpdatedAnyAssignmentStatus = myAssignments.some(
    (a) => a.status !== null
  );

  const checklistSteps = deriveChecklist({
    memberships: checklistMemberships,
    hasInvitedOrSecondMember,
    hasAuthoredNote,
    myAssignmentCount: myAssignments.length,
    hasUpdatedAnyAssignmentStatus,
  });

  const onboardingState = parseOnboardingState(dbUser.onboardingState);

  // Build the typed Set of skipped step keys, defensively filtering through
  // `isChecklistStepKey` in case stale keys hang around in the JSON blob
  // (e.g. a step was renamed and the user's old skip is still in the DB).
  const skippedKeys = new Set<ChecklistStepKey>(
    Object.keys(onboardingState.checklistStepsSkipped ?? {}).filter(
      isChecklistStepKey
    )
  );

  return (
    <>
      <DashboardMetaBand
        displayName={displayName}
        teamsCount={memberships.length}
        onPlateCount={myNotes.onPlate}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 sm:gap-8">
        <OnboardingChecklist
          steps={checklistSteps}
          isDismissed={isChecklistDismissed(onboardingState)}
          skippedKeys={skippedKeys}
        />

        <WorkTiles
          myNotes={myNotes}
          notesByMe={notesByMe}
          showNotesByMe={showNotesByMe}
        />

        <TeamsSection teams={teamRows} />
      </main>
    </>
  );
}

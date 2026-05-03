import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { isNoteStalled } from "@/lib/notes/stalled";
import { isActiveStatus, type NoteStatus } from "@/lib/notes/statuses";

import { DashboardMetaBand } from "./dashboard-meta-band";
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
                  select: { rehearsalDate: true },
                },
              },
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

  return (
    <>
      <DashboardMetaBand
        displayName={displayName}
        teamsCount={memberships.length}
        onPlateCount={myNotes.onPlate}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6 sm:gap-8">
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

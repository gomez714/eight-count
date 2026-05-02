import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getProjectGroups } from "@/lib/groups/get-project-groups";
import { isNoteStalled } from "@/lib/notes/stalled";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";
import type { NoteProgressCounts } from "@/components/note-progress-bar";
import type { NoteStatus } from "@/lib/notes/statuses";

import { NewRehearsalButton } from "./new-rehearsal-button";
import { ProjectMetaBand } from "./project-meta-band";
import {
  ProjectGroupsSection,
  type TeamMemberOption,
} from "./project-groups-section";
import { ProjectMobileTabs } from "./project-mobile-tabs";
import { RehearsalsSection } from "./rehearsals-section";
import type { RehearsalRowData } from "./rehearsal-row";

import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: Readonly<ProjectPageProps>) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await ensureDbUser();

  if (!dbUser) {
    redirect("/sign-in");
  }

  const { projectId } = await params;

  const project = await getProjectForUser(projectId, dbUser.id);

  if (!project) {
    notFound();
  }

  const [rehearsals, groups, allTeamMembers] = await Promise.all([
    db.rehearsal.findMany({
      where: { projectId: project.id },
      orderBy: { rehearsalDate: "desc" },
      include: {
        videoAsset: {
          select: { durationMs: true },
        },
        notes: {
          select: {
            id: true,
            noteType: true,
            createdAt: true,
            author: { select: { id: true, name: true, email: true } },
            assignments: {
              select: {
                id: true,
                status: { select: { status: true } },
              },
            },
          },
        },
      },
    }),
    getProjectGroups(project.id),
    db.teamMember.findMany({
      where: { teamId: project.team.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const membership = project.team.members[0];
  const role = membership?.role ?? null;
  const canManageGroups = role === "ADMIN" || role === "INSTRUCTOR";
  const canCreateRehearsal = role === "ADMIN" || role === "INSTRUCTOR";

  const teamMemberOptions: TeamMemberOption[] = allTeamMembers.map(
    (member) => ({
      teamMemberId: member.id,
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })
  );

  const groupItems = groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    memberTeamMemberIds: group.members.map(
      (groupMember) => groupMember.teamMemberId
    ),
  }));

  const stalledNow = new Date();

  const rehearsalRows: RehearsalRowData[] = rehearsals.map((rehearsal, idx) => {
    const counts: NoteProgressCounts = {
      OPEN: 0,
      IN_PROGRESS: 0,
      ADDRESSED: 0,
      RESOLVED: 0,
    };
    let voiceCount = 0;
    let stalledCount = 0;
    const contributorMap = new Map<
      string,
      { id: string; name: string | null; email: string }
    >();

    for (const note of rehearsal.notes) {
      if (note.noteType === "VOICE") voiceCount += 1;
      contributorMap.set(note.author.id, {
        id: note.author.id,
        name: note.author.name,
        email: note.author.email,
      });

      const noteAssignments: { status: NoteStatus }[] = [];
      for (const assignment of note.assignments) {
        const status = (assignment.status?.status ?? "OPEN") as NoteStatus;
        counts[status] += 1;
        noteAssignments.push({ status });
      }

      if (
        isNoteStalled({
          createdAt: note.createdAt,
          assignments: noteAssignments,
          now: stalledNow,
        })
      ) {
        stalledCount += 1;
      }
    }

    return {
      id: rehearsal.id,
      title: rehearsal.title,
      rehearsalDate: rehearsal.rehearsalDate,
      hasVideo: !!rehearsal.videoAsset,
      videoDurationMs: rehearsal.videoAsset?.durationMs ?? null,
      noteCounts: {
        total: rehearsal.notes.length,
        voice: voiceCount,
      },
      assignmentCounts: counts,
      contributors: [...contributorMap.values()],
      stalledCount,
      isCurrent: idx === 0 && rehearsals.length > 1,
    };
  });

  const openNotesCount = rehearsalRows.reduce(
    (acc, r) => acc + r.assignmentCounts.OPEN + r.assignmentCounts.IN_PROGRESS,
    0
  );

  // Aggregate distinct contributors across the project for the meta band.
  const projectContributorMap = new Map<
    string,
    { id: string; name: string | null; email: string }
  >();
  for (const row of rehearsalRows) {
    for (const c of row.contributors) {
      projectContributorMap.set(c.id, c);
    }
  }
  const projectContributors = [...projectContributorMap.values()];

  return (
    <>
      <ProjectMetaBand
        team={{ id: project.team.id, name: project.team.name }}
        project={{
          id: project.id,
          title: project.title,
          description: project.description,
          status: project.status,
        }}
        role={role}
        rehearsalCount={rehearsalRows.length}
        castCount={allTeamMembers.length}
        openNotesCount={openNotesCount}
        contributors={projectContributors}
        actions={
          <>
            <Button
              asChild
              variant="outline"
              size="sm"
              aria-label="Manage cast"
            >
              <Link href={`/teams/${project.team.id}`}>
                <Users aria-hidden className="size-3.5" />
                <span className="hidden sm:inline">Manage cast</span>
              </Link>
            </Button>
            {canCreateRehearsal ? (
              <NewRehearsalButton projectId={project.id} size="sm" />
            ) : null}
          </>
        }
      />

      <main className="mx-auto w-full max-w-7xl px-6 py-6">
        <ProjectMobileTabs
          rehearsalCount={rehearsalRows.length}
          groupCount={groupItems.length}
          rehearsals={
            <RehearsalsSection
              projectId={project.id}
              rehearsals={rehearsalRows}
              canManage={canCreateRehearsal}
            />
          }
          groups={
            <ProjectGroupsSection
              projectId={project.id}
              canManage={canManageGroups}
              groups={groupItems}
              teamMembers={teamMemberOptions}
            />
          }
        />
      </main>
    </>
  );
}

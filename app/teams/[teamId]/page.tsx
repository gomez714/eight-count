import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { isActiveStatus, type NoteStatus } from "@/lib/notes/statuses";
import { getTeamForUser } from "@/lib/teams/get-team-for-user";

import { MembersSection } from "./members-section";
import { type MemberRowData } from "./member-row";
import { type PendingInvitationRowData } from "./pending-invitation-row";
import { ProjectsSection } from "./projects-section";
import { type ProjectRowData } from "./project-row";
import { TeamActionsMenu } from "./team-actions-menu";
import { TeamMetaBand } from "./team-meta-band";
import { TeamMobileTabs } from "./team-mobile-tabs";
import { type TeamRole } from "./role-chip";

type TeamPageProps = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamPage({ params }: Readonly<TeamPageProps>) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await ensureDbUser();

  if (!dbUser) {
    redirect("/sign-in");
  }

  const { teamId } = await params;

  const team = await getTeamForUser(teamId, dbUser.id);

  if (!team) {
    notFound();
  }

  const [projects, teamMembers, pendingInvites] = await Promise.all([
    db.project.findMany({
      where: { teamId: team.id },
      include: {
        rehearsals: {
          select: {
            id: true,
            updatedAt: true,
            notes: {
              select: {
                id: true,
                updatedAt: true,
                assignments: {
                  select: {
                    status: { select: { status: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.teamMember.findMany({
      where: {
        teamId: team.id,
        // Soft-deleted users disappear from team rosters but their
        // historical notes / assignments stay attributed.
        user: { deletedAt: null },
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.teamInvitation.findMany({
      where: { teamId: team.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const viewerRole = (team.members[0]?.role ?? null) as TeamRole | null;
  const canManageMembers = viewerRole === "ADMIN";
  const canCreateProjects =
    viewerRole === "ADMIN" || viewerRole === "INSTRUCTOR";

  const memberRows: MemberRowData[] = teamMembers.map((member) => ({
    teamMemberId: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    role: member.role as TeamRole,
    joinedAt: member.createdAt,
    isYou: member.userId === dbUser.id,
  }));

  const pendingInvitationRows: PendingInvitationRowData[] = pendingInvites.map(
    (invite) => ({
      invitationId: invite.id,
      email: invite.email,
      role: invite.role as TeamRole,
      invitedAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    })
  );

  const roleGlance: { role: TeamRole; count: number }[] = (
    ["ADMIN", "INSTRUCTOR", "ASSISTANT", "DANCER"] as TeamRole[]
  ).map((role) => ({
    role,
    count: memberRows.filter((m) => m.role === role).length,
  }));

  const projectRows: ProjectRowData[] = projects.map((project) => {
    let openNotes = 0;
    let lastActivity: Date | null = null;

    for (const rehearsal of project.rehearsals) {
      if (!lastActivity || rehearsal.updatedAt > lastActivity) {
        lastActivity = rehearsal.updatedAt;
      }

      for (const note of rehearsal.notes) {
        if (!lastActivity || note.updatedAt > lastActivity) {
          lastActivity = note.updatedAt;
        }
        for (const assignment of note.assignments) {
          const status = (assignment.status?.status ?? "OPEN") as NoteStatus;
          if (isActiveStatus(status)) openNotes += 1;
        }
      }
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      rehearsalCount: project.rehearsals.length,
      openNotesCount: openNotes,
      lastActivity,
      createdAt: project.createdAt,
    };
  });

  return (
    <>
      <TeamMetaBand
        team={{ id: team.id, name: team.name }}
        viewerRole={viewerRole}
        memberCount={memberRows.length}
        projectCount={projectRows.length}
        roleGlance={roleGlance}
        createdAt={team.createdAt}
        titleActions={
          viewerRole === "ADMIN" ? (
            <TeamActionsMenu teamId={team.id} teamName={team.name} />
          ) : null
        }
      />

      <main className="mx-auto w-full max-w-7xl px-6 py-6">
        <TeamMobileTabs
          projectCount={projectRows.length}
          memberCount={memberRows.length}
          projects={
            <ProjectsSection
              teamId={team.id}
              projects={projectRows}
              canCreate={canCreateProjects}
            />
          }
          members={
            <MembersSection
              teamId={team.id}
              members={memberRows}
              pendingInvitations={pendingInvitationRows}
              canManage={canManageMembers}
            />
          }
        />
      </main>
    </>
  );
}

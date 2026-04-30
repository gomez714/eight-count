import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getProjectGroups } from "@/lib/groups/get-project-groups";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";

import { CreateRehearsalForm } from "./create-rehearsal-form";
import {
  ProjectGroupsSection,
  type TeamMemberOption,
} from "./project-groups-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
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
      where: {
        projectId: project.id,
      },
      orderBy: {
        rehearsalDate: "desc",
      },
    }),
    getProjectGroups(project.id),
    db.teamMember.findMany({
      where: {
        teamId: project.team.id,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const membership = project.team.members[0];
  const canManageGroups =
    membership?.role === "ADMIN" || membership?.role === "INSTRUCTOR";

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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{project.title}</h1>
        <p className="text-sm text-muted-foreground">
          Team: {project.team.name}
        </p>
        <p className="text-sm text-muted-foreground">
          Your role: {membership?.role ?? "UNKNOWN"}
        </p>
        {project.description ? (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        ) : null}
      </section>

      <section>
        <CreateRehearsalForm projectId={project.id} />
      </section>

      <ProjectGroupsSection
        projectId={project.id}
        canManage={canManageGroups}
        groups={groupItems}
        teamMembers={teamMemberOptions}
      />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Rehearsals</h2>
          <p className="text-sm text-muted-foreground">
            Rehearsals for this project will appear here.
          </p>
        </div>

        {rehearsals.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No rehearsals yet. Create the first one above.
              </p>
            </CardContent>
          </Card>
        ) : (
            <div className="grid gap-4 md:grid-cols-2">
            {rehearsals.map((rehearsal) => (
              <Link key={rehearsal.id} href={`/rehearsals/${rehearsal.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">{rehearsal.title}</CardTitle>
                    <CardDescription>
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(rehearsal.rehearsalDate)}
                    </CardDescription>
                  </CardHeader>
                  {rehearsal.description ? (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {rehearsal.description}
                      </p>
                    </CardContent>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getTeamForUser } from "@/lib/teams/get-team-for-user";

import { AddTeamMemberForm } from "./add-team-member-form";
import { CreateProjectForm } from "./create-project-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TeamPageProps = {
  params: Promise<{
    teamId: string;
  }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
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

  const projects = await db.project.findMany({
    where: {
      teamId: team.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const teamMembers = await db.teamMember.findMany({
    where: {
      teamId: team.id,
    },
    include: {
      user: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const membership = team.members[0];
  const canManageMembers = membership?.role === "ADMIN";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{team.name}</h1>
        <p className="text-sm text-muted-foreground">
          Your role: {membership?.role ?? "UNKNOWN"}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <CreateProjectForm teamId={team.id} />
        {canManageMembers ? <AddTeamMemberForm teamId={team.id} /> : null}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Team members</h2>
          <p className="text-sm text-muted-foreground">
            People currently in this team.
          </p>
        </div>

        {teamMembers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No members yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teamMembers.map((member) => (
              <Card key={member.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {member.user.name || member.user.email}
                  </CardTitle>
                  <CardDescription>{member.user.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Role: {member.role}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Projects for this team will appear here.
          </p>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No projects yet. Create the first one above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">{project.title}</CardTitle>
                    <CardDescription>
                      {project.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
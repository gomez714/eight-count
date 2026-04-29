import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { db } from "@/lib/db"

import { CreateTeamForm } from "./create-team-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function DashboardPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const dbUser = await ensureDbUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  const memberships = await db.teamMember.findMany({
    where: {
      userId: dbUser.id,
    },
    include: {
      team: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {dbUser.email}
        </p>
      </section>

      <section>
        <Link href="/my-notes">
          <Card className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">My notes</CardTitle>
              <CardDescription>
                See feedback assigned to you and update its status.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      <section>
        <CreateTeamForm />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Your teams</h2>
          <p className="text-sm text-muted-foreground">
            Teams you belong to will appear here.
          </p>
        </div>

        {memberships.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No teams yet. Create your first one above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {memberships.map((membership) => (
              <Link key={membership.id} href={`/teams/${membership.team.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {membership.team.name}
                    </CardTitle>
                    <CardDescription>Role: {membership.role}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

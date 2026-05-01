import { auth } from "@clerk/nextjs/server"
import { notFound, redirect } from "next/navigation"

import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user"

import { UploadVideoForm } from "./upload-video-form"
import { RehearsalWorkspace } from "./workspace/rehearsal-workspace"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type RehearsalPageProps = {
  params: Promise<{
    rehearsalId: string
  }>
}

export default async function RehearsalPage({ params }: RehearsalPageProps) {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  const dbUser = await ensureDbUser()

  if (!dbUser) {
    redirect("/sign-in")
  }

  const { rehearsalId } = await params

  const rehearsal = await getRehearsalForUser(rehearsalId, dbUser.id)

  if (!rehearsal) {
    notFound()
  }

  const membership = rehearsal.project.team.members.find(
    (member) => member.userId === dbUser.id
  )
  const canAuthorNotes =
    membership?.role === "ADMIN" ||
    membership?.role === "INSTRUCTOR" ||
    membership?.role === "ASSISTANT"

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {rehearsal.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Project: {rehearsal.project.title}
        </p>
        <p className="text-sm text-muted-foreground">
          Team: {rehearsal.project.team.name}
        </p>
        <p className="text-sm text-muted-foreground">
          Your role: {membership?.role ?? "UNKNOWN"}
        </p>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(rehearsal.rehearsalDate)}
        </p>
        {rehearsal.description ? (
          <p className="text-sm text-muted-foreground">
            {rehearsal.description}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Video</h2>
          <p className="text-sm text-muted-foreground">
            Upload and manage the rehearsal video for this session.
          </p>
        </div>

        <UploadVideoForm
          rehearsalId={rehearsal.id}
          hasExistingVideo={!!rehearsal.videoAsset}
        />

        {!rehearsal.videoAsset ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No video uploaded yet</CardTitle>
              <CardDescription>
                Upload a rehearsal video to attach media to this session.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            <RehearsalWorkspace
              rehearsalId={rehearsal.id}
              fileName={rehearsal.videoAsset.originalFileName}
              canAuthorNotes={canAuthorNotes}
              currentUserId={dbUser.id}
              assignableMembers={rehearsal.project.team.members.map(
                (member) => ({
                  id: member.user.id,
                  name: member.user.name,
                  email: member.user.email,
                  role: member.role,
                })
              )}
              availableGroups={rehearsal.project.groups.map((group) => ({
                id: group.id,
                name: group.name,
                memberUserIds: group.members.map(
                  (groupMember) => groupMember.teamMember.userId
                ),
              }))}
              notes={rehearsal.notes.map((note) => ({
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
                      status: note.audioAsset.status,
                    }
                  : null,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                author: {
                  id: note.author.id,
                  name: note.author.name,
                  email: note.author.email,
                },
                assignments: note.assignments.map((assignment) => ({
                  id: assignment.id,
                  user: {
                    id: assignment.user.id,
                    name: assignment.user.name,
                    email: assignment.user.email,
                  },
                  status: assignment.status
                    ? {
                        id: assignment.status.id,
                        status: assignment.status.status,
                      }
                    : null,
                })),
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
              }))}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Video details</CardTitle>
                <CardDescription>
                  Status: {rehearsal.videoAsset.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>MIME type: {rehearsal.videoAsset.mimeType}</p>
                <p>
                  Size: {rehearsal.videoAsset.fileSizeBytes.toString()} bytes
                </p>
                <p>Object path: {rehearsal.videoAsset.objectPath}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </main>
  )
}

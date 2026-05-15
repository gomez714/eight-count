import { auth } from "@clerk/nextjs/server"
import { Film } from "lucide-react"
import { notFound, redirect } from "next/navigation"

import { ensureDbUser } from "@/lib/auth/ensure-db-user"
import { summarizeThread } from "@/lib/notes/comments"
import { getActiveAssignmentsForProjects } from "@/lib/notes/get-active-assignments-for-project"
import {
  buildRepeatingMarkerByAssignmentId,
  detectRepeatingClusters,
} from "@/lib/notes/repeating"
import {
  isTipGroupDismissed,
  parseOnboardingState,
} from "@/lib/onboarding/state"
import { getRehearsalForUser } from "@/lib/rehearsals/get-rehearsal-for-user"

import { RehearsalActionsMenu } from "./rehearsal-actions-menu"
import { RehearsalContextBar } from "./rehearsal-context-bar"
import { UploadVideoForm } from "./upload-video-form"
import { RehearsalWorkspace } from "./workspace/rehearsal-workspace"

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
  const isStaff =
    membership?.role === "ADMIN" ||
    membership?.role === "INSTRUCTOR" ||
    membership?.role === "ASSISTANT"
  const canAuthorNotes = isStaff
  const canManageVideo = isStaff
  const hasVideo = !!rehearsal.videoAsset

  const workspaceTipsDismissed = isTipGroupDismissed(
    parseOnboardingState(dbUser.onboardingState),
    "workspace"
  )

  // Repeating-correction detection runs once per request across all active
  // assignments in this project. Each note's per-assignment repeating
  // markers are threaded down so NoteRow can flag clusters per recipient.
  const projectId = rehearsal.project.id
  const projectActiveAssignments = await getActiveAssignmentsForProjects([
    projectId,
  ])
  const repeatingClusters = detectRepeatingClusters(
    projectActiveAssignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      projectId: a.note.rehearsal.projectId,
      tag: a.note.tag,
      status: a.status?.status ?? "OPEN",
    }))
  )
  const repeatingByAssignmentId = buildRepeatingMarkerByAssignmentId(
    repeatingClusters
  )

  return (
    <>
      <RehearsalContextBar
        team={{
          id: rehearsal.project.team.id,
          name: rehearsal.project.team.name,
        }}
        project={{
          id: rehearsal.project.id,
          title: rehearsal.project.title,
        }}
        rehearsal={{
          title: rehearsal.title,
          date: rehearsal.rehearsalDate,
          description: rehearsal.description,
        }}
        role={membership?.role ?? null}
        memberCount={rehearsal.project.team.members.length}
        videoFileName={rehearsal.videoAsset?.originalFileName ?? null}
        actions={
          canManageVideo && hasVideo ? (
            <RehearsalActionsMenu
              rehearsalId={rehearsal.id}
              hasExistingVideo={hasVideo}
            />
          ) : null
        }
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
        {hasVideo && rehearsal.videoAsset ? (
          <RehearsalWorkspace
            rehearsalId={rehearsal.id}
            fileName={rehearsal.videoAsset.originalFileName}
            canAuthorNotes={canAuthorNotes}
            currentUserId={dbUser.id}
            workspaceTipsDismissed={workspaceTipsDismissed}
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
            notes={rehearsal.notes.map((note) => {
              const noteRepeating: Record<string, { tag: NonNullable<typeof note.tag>; count: number }> = {}
              for (const assignment of note.assignments) {
                const marker = repeatingByAssignmentId.get(assignment.id)
                if (marker) noteRepeating[assignment.id] = marker
              }
              const threadSummary = summarizeThread({
                viewerId: dbUser.id,
                comments: note.comments,
                reactions: note.reactions,
                lastViewedAt: note.threadViews[0]?.lastViewedAt ?? null,
              })
              return ({
              id: note.id,
              noteType: note.noteType,
              bodyText: note.bodyText,
              startTimestampMs: note.startTimestampMs,
              endTimestampMs: note.endTimestampMs,
              tag: note.tag,
              audioAsset: note.audioAsset
                ? {
                    id: note.audioAsset.id,
                    mimeType: note.audioAsset.mimeType,
                    durationMs: note.audioAsset.durationMs,
                    status: note.audioAsset.status,
                    transcript: note.audioAsset.transcript,
                    transcriptStatus: note.audioAsset.transcriptStatus,
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
              repeatingByAssignmentId: noteRepeating,
              thread: threadSummary,
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
            })
            })}
          />
        ) : (
          <NoVideoEmptyState
            rehearsalId={rehearsal.id}
            canManageVideo={canManageVideo}
          />
        )}
      </main>
    </>
  )
}

function NoVideoEmptyState({
  rehearsalId,
  canManageVideo,
}: {
  rehearsalId: string
  canManageVideo: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <span
        aria-hidden
        className="inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Film className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">No video yet</h2>
        <p className="text-sm text-muted-foreground">
          {canManageVideo
            ? "Upload a rehearsal video to start leaving timestamped notes."
            : "Your instructor will upload one for this session."}
        </p>
      </div>
      {canManageVideo ? (
        <div className="w-full pt-2 text-left">
          <UploadVideoForm
            rehearsalId={rehearsalId}
            submitLabel="Upload video"
          />
        </div>
      ) : null}
    </div>
  )
}

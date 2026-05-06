import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getProjectGroups } from "@/lib/groups/get-project-groups";
import { getActiveAssignmentsForProjects } from "@/lib/notes/get-active-assignments-for-project";
import { detectRepeatingClusters } from "@/lib/notes/repeating";
import { isNoteStalled } from "@/lib/notes/stalled";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";
import type { NoteProgressCounts } from "@/components/note-progress-bar";
import type { NoteStatus } from "@/lib/notes/statuses";

import { NewRehearsalButton } from "./new-rehearsal-button";
import { ProjectDrillSection, type DrillBoardRecipient } from "./project-drill-section";
import { ProjectMetaBand } from "./project-meta-band";
import {
  ProjectGroupsSection,
  type TeamMemberOption,
} from "./project-groups-section";
import { ProjectMobileTabs } from "./project-mobile-tabs";
import { RehearsalsSection } from "./rehearsals-section";
import { RepeatingClustersCard } from "./repeating-clusters-card";
import type { RehearsalRowData } from "./rehearsal-row";

import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

// Pulled out so the derivation doesn't bump the page function's already-high
// cognitive complexity score, and so the same rule lives next to the
// `/my-notes` drill view's identical guard if/when it gets shared.
function readyTranscript(
  audioAsset: { transcript: string | null; transcriptStatus: string } | null
): string | null {
  if (audioAsset?.transcriptStatus !== "READY") return null;
  return audioAsset.transcript;
}

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
  const canCreateRehearsal =
    role === "ADMIN" || role === "INSTRUCTOR" || role === "ASSISTANT";
  // Staff-only surfaces: the project-level drill board, repeating-clusters
  // card, and "Manage cast" CTA all concentrate per-dancer struggle data
  // in ways meant for instructors, not peers. Dancers get their own
  // personal drill view at /my-notes?view=drill.
  const isStaff =
    role === "ADMIN" || role === "INSTRUCTOR" || role === "ASSISTANT";

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

  // Active assignments scoped to this project, used for both the
  // RepeatingClustersCard (summary) and the ProjectDrillSection (detail).
  const projectActiveAssignments = await getActiveAssignmentsForProjects([
    project.id,
  ]);
  const projectClusters = detectRepeatingClusters(
    projectActiveAssignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      projectId: a.note.rehearsal.projectId,
      tag: a.note.tag,
      status: a.status?.status ?? "OPEN",
    }))
  );

  const clusterSummaries = projectClusters
    .map((cluster) => {
      const a = projectActiveAssignments.find((x) => x.userId === cluster.userId);
      if (!a) return null;
      return {
        userId: cluster.userId,
        userName: a.user.name,
        userEmail: a.user.email,
        tag: cluster.tag,
        count: cluster.count,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.count - a.count);

  // Build per-recipient drill board.
  const drillByUser = new Map<string, DrillBoardRecipient>();
  for (const a of projectActiveAssignments) {
    let recipient = drillByUser.get(a.userId);
    if (!recipient) {
      recipient = {
        userId: a.userId,
        userName: a.user.name,
        userEmail: a.user.email,
        buckets: [],
        totalItems: 0,
        repeatingClusterCount: 0,
      };
      drillByUser.set(a.userId, recipient);
    }
    const bucketTag = a.note.tag;
    let bucket = recipient.buckets.find((b) => b.tag === bucketTag);
    if (!bucket) {
      bucket = {
        tag: bucketTag,
        items: [],
        isRepeating: false,
        repeatingCount: 0,
      };
      recipient.buckets.push(bucket);
    }
    bucket.items.push({
      assignmentId: a.id,
      noteId: a.noteId,
      noteType: a.note.noteType,
      bodyText: a.note.bodyText,
      voiceTranscript: readyTranscript(a.note.audioAsset),
      audioDurationMs: a.note.audioAsset?.durationMs ?? null,
      startTimestampMs: a.note.startTimestampMs,
      status: (a.status?.status ?? "OPEN") as NoteStatus,
      rehearsalId: a.note.rehearsal.id,
      rehearsalTitle: a.note.rehearsal.title,
    });
    recipient.totalItems += 1;
  }

  // Mark repeating buckets and count clusters per recipient.
  for (const cluster of projectClusters) {
    const recipient = drillByUser.get(cluster.userId);
    if (!recipient) continue;
    const bucket = recipient.buckets.find((b) => b.tag === cluster.tag);
    if (bucket) {
      bucket.isRepeating = true;
      bucket.repeatingCount = cluster.count;
    }
    recipient.repeatingClusterCount += 1;
  }

  const drillRecipients: DrillBoardRecipient[] = [...drillByUser.values()].sort(
    (a, b) => {
      if (a.repeatingClusterCount !== b.repeatingClusterCount) {
        return b.repeatingClusterCount - a.repeatingClusterCount;
      }
      const aName = (a.userName || a.userEmail).toLowerCase();
      const bName = (b.userName || b.userEmail).toLowerCase();
      return aName.localeCompare(bName);
    }
  );

  // If the viewer is a recipient in this project, default-expand their row;
  // otherwise default-expand the dancer with the most repeating clusters.
  const viewerIsRecipient = drillRecipients.some(
    (r) => r.userId === dbUser.id
  );
  const initialExpandedUserId = viewerIsRecipient
    ? dbUser.id
    : (drillRecipients[0]?.userId ?? null);

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
            {isStaff ? (
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
            ) : null}
            {canCreateRehearsal ? (
              <NewRehearsalButton projectId={project.id} size="sm" />
            ) : null}
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
        {isStaff ? <RepeatingClustersCard clusters={clusterSummaries} /> : null}

        {isStaff && drillRecipients.length > 0 ? (
          <ProjectDrillSection
            recipients={drillRecipients}
            initialExpandedUserId={initialExpandedUserId}
          />
        ) : null}

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

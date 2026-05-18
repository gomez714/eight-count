import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ensureDbUser } from "@/lib/auth/ensure-db-user";
import { db } from "@/lib/db";
import { getDiscussionsForProject } from "@/lib/discussions/get-discussions-for-project";
import { getProjectGroups } from "@/lib/groups/get-project-groups";
import {
  getActiveAssignmentsForProjects,
  type ActiveAssignmentRow,
} from "@/lib/notes/get-active-assignments-for-project";
import {
  detectRepeatingClusters,
  type RepeatingCluster,
  type RepeatingClusterDetail,
  type RepeatingClusterDetailItem,
} from "@/lib/notes/repeating";
import { isNoteStalled } from "@/lib/notes/stalled";
import type { NoteTag } from "@/lib/notes/tags";
import { getProjectForUser } from "@/lib/projects/get-project-for-user";
import { summarizeThread } from "@/lib/threads/comments";
import type { NoteProgressCounts } from "@/components/note-progress-bar";
import type { NoteStatus } from "@/lib/notes/statuses";

import { DiscussionsSection } from "./discussions-section";
import { NewRehearsalButton } from "./new-rehearsal-button";
import { ProjectDrillSection, type DrillBoardRecipient } from "./project-drill-section";
import { ProjectMetaBand } from "./project-meta-band";
import type { ProjectDiscussionItem } from "./project-discussion-row";
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

function getOrCreateRecipient(
  drillByUser: Map<string, DrillBoardRecipient>,
  a: ActiveAssignmentRow,
): DrillBoardRecipient {
  let recipient = drillByUser.get(a.userId);
  if (recipient) return recipient;
  recipient = {
    userId: a.userId,
    userName: a.user.name,
    userEmail: a.user.email,
    buckets: [],
    totalItems: 0,
    repeatingClusterCount: 0,
  };
  drillByUser.set(a.userId, recipient);
  return recipient;
}

function getOrCreateBucket(
  recipient: DrillBoardRecipient,
  tag: NoteTag | null,
) {
  let bucket = recipient.buckets.find((b) => b.tag === tag);
  if (bucket) return bucket;
  bucket = { tag, items: [], isRepeating: false, repeatingCount: 0 };
  recipient.buckets.push(bucket);
  return bucket;
}

// Pass 1: assignments → per-recipient buckets. Items start with
// `isRepeating: false` — pass 2 flags them via the cluster set.
function assembleDrillBuckets(
  activeAssignments: ReadonlyArray<ActiveAssignmentRow>,
): Map<string, DrillBoardRecipient> {
  const drillByUser = new Map<string, DrillBoardRecipient>();
  for (const a of activeAssignments) {
    const recipient = getOrCreateRecipient(drillByUser, a);
    const bucket = getOrCreateBucket(recipient, a.note.tag);
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
      createdAtMs: a.note.createdAt.getTime(),
      rehearsalDateMs: a.note.rehearsal.rehearsalDate.getTime(),
      isRepeating: false,
    });
    recipient.totalItems += 1;
  }
  return drillByUser;
}

// Pass 2: clusters → mark each buckets's repeating fields + tag each
// item in the cluster so the in-bucket priority sort can read it
// directly without a second cluster lookup.
function flagRepeatingClusters(
  drillByUser: Map<string, DrillBoardRecipient>,
  clusters: ReadonlyArray<RepeatingCluster>,
): void {
  for (const cluster of clusters) {
    const recipient = drillByUser.get(cluster.userId);
    if (!recipient) continue;
    const bucket = recipient.buckets.find((b) => b.tag === cluster.tag);
    if (bucket) {
      bucket.isRepeating = true;
      bucket.repeatingCount = cluster.count;
      const clusterIds = new Set(cluster.assignmentIds);
      for (const item of bucket.items) {
        if (clusterIds.has(item.assignmentId)) {
          item.isRepeating = true;
        }
      }
    }
    recipient.repeatingClusterCount += 1;
  }
}

function compareRecipients(a: DrillBoardRecipient, b: DrillBoardRecipient) {
  if (a.repeatingClusterCount !== b.repeatingClusterCount) {
    return b.repeatingClusterCount - a.repeatingClusterCount;
  }
  const aName = (a.userName || a.userEmail).toLowerCase();
  const bName = (b.userName || b.userEmail).toLowerCase();
  return aName.localeCompare(bName);
}

// Per-recipient drill board build. Pulled out of `ProjectPage` to keep
// the page entry's cognitive complexity within bounds.
function buildDrillRecipients(
  activeAssignments: ReadonlyArray<ActiveAssignmentRow>,
  clusters: ReadonlyArray<RepeatingCluster>,
): DrillBoardRecipient[] {
  const drillByUser = assembleDrillBuckets(activeAssignments);
  flagRepeatingClusters(drillByUser, clusters);
  return [...drillByUser.values()].sort(compareRecipients);
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

  const [rehearsals, groups, allTeamMembers, discussionRows] =
    await Promise.all([
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
        where: {
          teamId: project.team.id,
          // Active members only — soft-deleted users disappear from
          // the cast-management surfaces. Historical attribution on
          // existing notes/assignments stays intact (those queries
          // don't filter by deletedAt).
          user: { deletedAt: null },
        },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      getDiscussionsForProject(project.id, dbUser.id),
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

  // Expandable cluster details for the project-page chips. Project surfaces
  // key by `${userId}-${tag}` so two dancers with clusters in the same tag
  // don't collide in the expansion coordinator. Same data shape as
  // `/my-notes`; built inline since it's only ~25 lines and the source
  // assignment shape is surface-specific.
  const projectActiveById = new Map(
    projectActiveAssignments.map((a) => [a.id, a]),
  );
  const projectClusterDetails: RepeatingClusterDetail[] = projectClusters.map(
    (cluster) => {
      const items: RepeatingClusterDetailItem[] = [];
      for (const id of cluster.assignmentIds) {
        const a = projectActiveById.get(id);
        if (!a) continue;
        items.push({
          assignmentId: a.id,
          noteId: a.noteId,
          rehearsalId: a.note.rehearsal.id,
          rehearsalTitle: a.note.rehearsal.title,
          startTimestampMs: a.note.startTimestampMs,
          noteType: a.note.noteType,
          bodyText: a.note.bodyText,
          voiceTranscript:
            a.note.audioAsset?.transcriptStatus === "READY"
              ? (a.note.audioAsset.transcript ?? null)
              : null,
          audioDurationMs: a.note.audioAsset?.durationMs ?? null,
          createdAtMs: a.note.createdAt.getTime(),
        });
      }
      items.sort((x, y) => y.createdAtMs - x.createdAtMs);
      return {
        key: `${cluster.userId}-${cluster.tag}`,
        tag: cluster.tag,
        count: cluster.count,
        items,
      };
    },
  );

  const drillRecipients = buildDrillRecipients(
    projectActiveAssignments,
    projectClusters,
  );

  // If the viewer is a recipient in this project, default-expand their row;
  // otherwise default-expand the dancer with the most repeating clusters.
  const viewerIsRecipient = drillRecipients.some(
    (r) => r.userId === dbUser.id
  );
  const initialExpandedUserId = viewerIsRecipient
    ? dbUser.id
    : (drillRecipients[0]?.userId ?? null);

  const discussions: ProjectDiscussionItem[] = discussionRows.map((d) => ({
    id: d.id,
    noteType: d.noteType,
    bodyText: d.bodyText,
    startTimestampMs: d.startTimestampMs,
    endTimestampMs: d.endTimestampMs,
    audioAsset: d.audioAsset
      ? {
          id: d.audioAsset.id,
          mimeType: d.audioAsset.mimeType,
          durationMs: d.audioAsset.durationMs,
          status: d.audioAsset.status,
          transcript: d.audioAsset.transcript,
          transcriptStatus: d.audioAsset.transcriptStatus,
        }
      : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    author: {
      id: d.author.id,
      name: d.author.name,
      email: d.author.email,
    },
    rehearsal: d.rehearsal
      ? { id: d.rehearsal.id, title: d.rehearsal.title }
      : null,
    thread: summarizeThread({
      viewerId: dbUser.id,
      comments: d.comments,
      reactions: d.reactions,
      lastViewedAt: d.threadViews[0]?.lastViewedAt ?? null,
    }),
  }));

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
        {isStaff ? (
          <RepeatingClustersCard
            clusters={clusterSummaries}
            clusterDetails={projectClusterDetails}
          />
        ) : null}

        {isStaff && drillRecipients.length > 0 ? (
          <ProjectDrillSection
            recipients={drillRecipients}
            initialExpandedUserId={initialExpandedUserId}
            clusterDetails={projectClusterDetails}
          />
        ) : null}

        <DiscussionsSection
          projectId={project.id}
          discussions={discussions}
          currentUserId={dbUser.id}
          canRetryTranscript={isStaff}
        />

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

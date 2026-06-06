import { pickAvatarTone } from "@/components/avatar-initials";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { MetaLine } from "@/components/dashboard/meta-line";
import { PersonalWorkspaceCard } from "@/components/dashboard/personal-workspace-card";
import { PinCard } from "@/components/dashboard/pin-card";
import { QuietWeekCard } from "@/components/dashboard/quiet-week-card";
import { TipStrip } from "@/components/dashboard/tip-strip";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { getActivityForUser } from "@/lib/activity/get-activity-for-user";
import {
  pickUpNext,
  type FirstNoteInput,
  type OldestUnresolvedInput,
  type UnfinishedRehearsalInput,
} from "@/lib/activity/pick-up-next";
import { isQuietWeek, pickMostRecent } from "@/lib/activity/quiet-week";
import { db } from "@/lib/db";
import { isNoteStalled } from "@/lib/notes/stalled";
import { isActiveStatus, type NoteStatus } from "@/lib/notes/statuses";
import {
  isTipGroupDismissed,
  parseOnboardingState,
} from "@/lib/onboarding/state";

import { TeamsSection } from "./teams-section";
import type { TeamRowData } from "./types";

/**
 * V2 dashboard — activity-led feed with a pinned Up Next card. Rendered
 * when `getUiVariant()` returns `"v2"`. Coexists with V1 (the original
 * meta-band + checklist + tiles layout) via a one-line branch in
 * `app/dashboard/page.tsx`.
 *
 * State branching:
 *   1. Zero teams  → WelcomeCard (entire screen)
 *   2. Zero activity in last 7 days → QuietWeekCard
 *   3. Otherwise → pin card (when one applies) + activity feed
 */

const AUTHOR_ROLES = new Set(["ADMIN", "INSTRUCTOR", "ASSISTANT"]);
const DAY_MS = 24 * 60 * 60 * 1000;

type DashboardV2Props = {
  dbUser: {
    id: string;
    name: string | null;
    onboardingState: unknown;
  };
  /** ISO timestamp from `?cursor=...` for "Show older activity" pagination. */
  cursor?: string;
};

export async function DashboardV2({
  dbUser,
  cursor,
}: Readonly<DashboardV2Props>) {
  const now = new Date();

  // Memberships first — `isPersonalOnly` derived from this drives both
  // the activity-feed's `includeSelf` flag and the pin-card's
  // `selfAuthored` framing. Cheap one-row-per-team query; the remaining
  // seven queries still run in parallel below.
  const memberships = await db.teamMember.findMany({
    where: { userId: dbUser.id },
    select: {
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          isPersonal: true,
          projects: {
            select: {
              id: true,
              rehearsals: {
                orderBy: { rehearsalDate: "desc" },
                take: 1,
                select: { id: true, rehearsalDate: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const isPersonalOnly =
    memberships.length === 1 && memberships[0].team.isPersonal;
  const personalWorkspaceName = isPersonalOnly
    ? memberships[0].team.name
    : null;

  const [
    myAssignments,
    authoredNotes,
    unreadCommentsCount,
    activityPage,
    oldestUnresolved,
    unfinishedRehearsalCandidate,
    mostRecentRehearsalWithVideo,
  ] = await Promise.all([
    db.noteAssignment.findMany({
      where: { userId: dbUser.id },
      select: { status: { select: { status: true } } },
    }),
    db.note.findMany({
      where: { authorUserId: dbUser.id },
      select: {
        createdAt: true,
        assignments: {
          select: { status: { select: { status: true } } },
        },
      },
    }),
    countUnreadCommentsForViewer(dbUser.id),
    getActivityForUser(dbUser.id, {
      cursor,
      includeSelf: isPersonalOnly,
    }),
    findOldestUnresolvedForViewer(dbUser.id),
    findUnfinishedRehearsalForStaff(dbUser.id),
    findMostRecentRehearsalWithVideo(dbUser.id),
  ]);

  const teamRows: TeamRowData[] = memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    role: m.role,
    projectCount: m.team.projects.length,
    lastActivityAt: maxRehearsalDate(m.team.projects),
    createdAt: m.team.createdAt,
    isPersonal: m.team.isPersonal,
  }));

  /* ----- brand-new ----- */
  if (memberships.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
        <WelcomeCard displayName={pickFirstName(dbUser.name)} />
      </main>
    );
  }

  /* ----- shared meta ----- */
  const onPlateCount = myAssignments.filter((a) =>
    isActiveStatus((a.status?.status ?? "OPEN") as NoteStatus)
  ).length;
  const notesByMeSent = authoredNotes.length;
  const stalledNow = now;
  const notesByMeStalled = authoredNotes.filter((note) =>
    isNoteStalled({
      createdAt: note.createdAt,
      assignments: note.assignments.map((a) => ({
        status: (a.status?.status ?? "OPEN") as NoteStatus,
      })),
      now: stalledNow,
    })
  ).length;
  const showNotesByMe = memberships.some((m) => AUTHOR_ROLES.has(m.role));
  const isStaffAnywhere = showNotesByMe;
  const displayName = pickFirstName(dbUser.name);

  const pick = pickUpNext(
    buildPinInputs({
      viewerId: dbUser.id,
      isStaffAnywhere,
      oldestUnresolved,
      unfinishedRehearsalCandidate,
      mostRecentRehearsalWithVideo,
    })
  );

  /* ----- quiet week ----- */
  const quietWeek = isQuietWeek(activityPage.items, now);
  if (quietWeek) {
    const mostRecent = pickMostRecent(activityPage.items);
    const daysAgo = mostRecent
      ? Math.max(
          1,
          Math.floor((now.getTime() - mostRecent.createdAt.getTime()) / DAY_MS)
        )
      : null;
    const pickBackUp = mostRecentRehearsalWithVideo
      ? {
          rehearsalId: mostRecentRehearsalWithVideo.id,
          rehearsalTitle: mostRecentRehearsalWithVideo.title,
          projectTitle: mostRecentRehearsalWithVideo.project.title,
        }
      : null;

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Welcome displayName={displayName} />
        <MetaLine
          teamsCount={memberships.length}
          onPlateCount={onPlateCount}
          notesByMeSent={notesByMeSent}
          notesByMeStalled={notesByMeStalled}
          unreadReplies={unreadCommentsCount}
          showNotesByMe={showNotesByMe}
        />
        {personalWorkspaceName ? (
          <PersonalWorkspaceCard workspaceName={personalWorkspaceName} />
        ) : null}
        <QuietWeekCard
          lastActorName={mostRecent?.actor.name ?? null}
          lastActivityDaysAgo={daysAgo}
          pickBackUp={pickBackUp}
        />
        <TeamsSection teams={teamRows} compact />
      </main>
    );
  }

  /* ----- normal feed ----- */
  const onboardingState = parseOnboardingState(dbUser.onboardingState);
  const showTip = !isTipGroupDismissed(onboardingState, "dashboard");

  // For the pin-dedup, the activity-feed needs the pinned note/discussion
  // id. Extract from the pick variant when applicable.
  const pinnedNoteId =
    pick?.reason === "oldest-unresolved" ? pick.data.noteId : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
      <Welcome displayName={displayName} />
      <MetaLine
        teamsCount={memberships.length}
        onPlateCount={onPlateCount}
        notesByMeSent={notesByMeSent}
        notesByMeStalled={notesByMeStalled}
        unreadReplies={unreadCommentsCount}
        showNotesByMe={showNotesByMe}
      />

      {showTip ? (
        <TipStrip>
          Tap any frame in the feed to jump to that moment in the rehearsal.
        </TipStrip>
      ) : null}

      {personalWorkspaceName ? (
        <PersonalWorkspaceCard workspaceName={personalWorkspaceName} />
      ) : null}

      {pick ? <PinCard pick={pick} /> : null}

      <ActivityFeed
        items={activityPage.items}
        hasMore={activityPage.hasMore}
        nextCursor={activityPage.nextCursor}
        pinnedNoteId={pinnedNoteId}
        allSelf={isPersonalOnly}
        now={now}
      />

      <TeamsSection teams={teamRows} compact />
    </main>
  );
}

/* ============================== helpers ============================== */

function Welcome({
  displayName,
}: Readonly<{ displayName: string | null }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {formatDateBanner(new Date())}
      </p>
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">
        Welcome back
        {displayName ? (
          <>
            , <span className="text-foreground">{displayName}</span>.
          </>
        ) : (
          "."
        )}
      </h1>
    </div>
  );
}

function pickFirstName(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] || null;
}

function maxRehearsalDate(
  projects: ReadonlyArray<{
    rehearsals: ReadonlyArray<{ rehearsalDate: Date | null }>;
  }>
): Date | null {
  const times: number[] = [];
  for (const p of projects) {
    const t = p.rehearsals[0]?.rehearsalDate?.getTime();
    if (typeof t === "number") times.push(t);
  }
  if (times.length === 0) return null;
  return new Date(Math.max(...times));
}

function formatDateBanner(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/* ----- counts ----- */

async function countUnreadCommentsForViewer(userId: string): Promise<number> {
  // Delegate to the existing helper that backs the V1 "new replies" chip.
  const { getUnreadCommentCountForUser } = await import(
    "@/lib/threads/get-unread-comment-count"
  );
  return getUnreadCommentCountForUser(userId);
}

/* ----- pin input builder ----- */

function buildPinInputs(args: {
  viewerId: string;
  isStaffAnywhere: boolean;
  oldestUnresolved: OldestUnresolvedRow;
  unfinishedRehearsalCandidate: UnfinishedRehearsalRow;
  mostRecentRehearsalWithVideo: RecentRehearsalRow;
}) {
  const oldest = args.oldestUnresolved
    ? buildOldestUnresolvedInput(args.oldestUnresolved, args.viewerId)
    : null;
  const unfinished = args.unfinishedRehearsalCandidate
    ? buildUnfinishedRehearsalInput(args.unfinishedRehearsalCandidate)
    : null;
  // Surface "leave your first note" only when nothing higher-priority
  // fired AND there's a real rehearsal to leave the note on. Carrying
  // the row (not a boolean) preserves TS narrowing into the ternary.
  const firstNoteRow =
    args.isStaffAnywhere && !oldest && !unfinished
      ? args.mostRecentRehearsalWithVideo
      : null;
  return {
    oldestUnresolved: oldest,
    unfinishedRehearsal: unfinished,
    // Unread-thread pin deferred to v1.5 — the activity feed surfaces
    // unread replies as highlighted rows in the meantime.
    unreadThread: null,
    firstNoteCandidate: firstNoteRow
      ? buildFirstNoteInput(firstNoteRow)
      : null,
  };
}

/* ----- pin queries ----- */

type OldestUnresolvedRow = Awaited<
  ReturnType<typeof findOldestUnresolvedForViewer>
>;

async function findOldestUnresolvedForViewer(userId: string) {
  return db.noteAssignment.findFirst({
    where: {
      userId,
      OR: [
        { status: null },
        { status: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
      ],
    },
    orderBy: { note: { createdAt: "asc" } },
    select: {
      createdAt: true,
      note: {
        select: {
          id: true,
          noteType: true,
          bodyText: true,
          startTimestampMs: true,
          tag: true,
          author: { select: { id: true, name: true } },
          rehearsal: {
            select: {
              id: true,
              title: true,
              project: {
                select: {
                  id: true,
                  title: true,
                  team: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

function buildOldestUnresolvedInput(
  row: NonNullable<OldestUnresolvedRow>,
  viewerId: string
): OldestUnresolvedInput {
  const note = row.note;
  return {
    noteId: note.id,
    noteType: note.noteType,
    bodyText: note.bodyText,
    startTimestampMs: note.startTimestampMs,
    tag: note.tag,
    // Cluster detection for the pin card deferred — surfaces inline in
    // /my-notes already; pin chrome will adopt it when the surface lands.
    repeatingCount: null,
    author: {
      id: note.author.id,
      name: note.author.name,
      tone: pickAvatarTone(note.author.id),
    },
    scope: {
      teamId: note.rehearsal.project.team.id,
      teamName: note.rehearsal.project.team.name,
      projectId: note.rehearsal.project.id,
      projectTitle: note.rehearsal.project.title,
      rehearsalId: note.rehearsal.id,
      rehearsalTitle: note.rehearsal.title,
    },
    assignedAt: row.createdAt,
    selfAuthored: note.author.id === viewerId,
  };
}

type UnfinishedRehearsalRow = Awaited<
  ReturnType<typeof findUnfinishedRehearsalForStaff>
>;

async function findUnfinishedRehearsalForStaff(userId: string) {
  return db.rehearsal.findFirst({
    where: {
      project: {
        team: {
          members: {
            some: {
              userId,
              role: { in: ["ADMIN", "INSTRUCTOR", "ASSISTANT"] },
            },
          },
        },
      },
      videoAsset: { status: "READY" },
      notes: { none: { authorUserId: userId } },
    },
    orderBy: { rehearsalDate: "desc" },
    select: {
      id: true,
      title: true,
      videoAsset: { select: { updatedAt: true } },
      project: {
        select: {
          id: true,
          title: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}

function buildUnfinishedRehearsalInput(
  row: NonNullable<UnfinishedRehearsalRow>
): UnfinishedRehearsalInput {
  return {
    rehearsalId: row.id,
    rehearsalTitle: row.title,
    startTimestampMs: 0,
    scope: {
      teamId: row.project.team.id,
      teamName: row.project.team.name,
      projectId: row.project.id,
      projectTitle: row.project.title,
      rehearsalId: row.id,
      rehearsalTitle: row.title,
    },
    videoReadyAt: row.videoAsset?.updatedAt ?? new Date(0),
  };
}

type RecentRehearsalRow = Awaited<
  ReturnType<typeof findMostRecentRehearsalWithVideo>
>;

async function findMostRecentRehearsalWithVideo(userId: string) {
  return db.rehearsal.findFirst({
    where: {
      project: {
        team: { members: { some: { userId } } },
      },
      videoAsset: { status: "READY" },
    },
    orderBy: { rehearsalDate: "desc" },
    select: {
      id: true,
      title: true,
      project: {
        select: {
          id: true,
          title: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}

function buildFirstNoteInput(
  row: NonNullable<RecentRehearsalRow>
): FirstNoteInput {
  return {
    rehearsalId: row.id,
    rehearsalTitle: row.title,
    scope: {
      teamId: row.project.team.id,
      teamName: row.project.team.name,
      projectId: row.project.id,
      projectTitle: row.project.title,
      rehearsalId: row.id,
      rehearsalTitle: row.title,
    },
  };
}

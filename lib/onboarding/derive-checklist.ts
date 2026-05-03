import type { TeamRole } from "@/generated/prisma/client";

export const CHECKLIST_STEP_KEYS = [
  "join-team",
  "invite-teammate",
  "add-project",
  "create-rehearsal",
  "leave-note",
  "check-inbox",
] as const;

export type ChecklistStepKey = (typeof CHECKLIST_STEP_KEYS)[number];

export function isChecklistStepKey(value: unknown): value is ChecklistStepKey {
  return (
    typeof value === "string" &&
    (CHECKLIST_STEP_KEYS as ReadonlyArray<string>).includes(value)
  );
}

export type ChecklistStep = {
  key: ChecklistStepKey;
  title: string;
  description: string;
  href: string;
  done: boolean;
  visible: boolean;
};

export type ChecklistInputMembership = {
  role: TeamRole;
  team: {
    id: string;
    projects: Array<{
      id: string;
      rehearsals: Array<{ id: string }>;
    }>;
  };
};

export type ChecklistInput = {
  memberships: ChecklistInputMembership[];
  /** Across teams the user ADMINs: at least one OTHER member or any invitation row. */
  hasInvitedOrSecondMember: boolean;
  /** User has authored at least one Note (anywhere). */
  hasAuthoredNote: boolean;
  /** Number of NoteAssignments where the user is the recipient. */
  myAssignmentCount: number;
  /** User has changed at least one of their assignment statuses (i.e. has interacted with /my-notes). */
  hasUpdatedAnyAssignmentStatus: boolean;
};

const PROJECT_AUTHOR_ROLES: ReadonlyArray<TeamRole> = ["ADMIN", "INSTRUCTOR"];
const STAFF_ROLES: ReadonlyArray<TeamRole> = [
  "ADMIN",
  "INSTRUCTOR",
  "ASSISTANT",
];

function pickFirst<T>(items: T[], pred: (item: T) => boolean): T | null {
  return items.find(pred) ?? null;
}

export function deriveChecklist(input: ChecklistInput): ChecklistStep[] {
  const {
    memberships,
    hasInvitedOrSecondMember,
    hasAuthoredNote,
    myAssignmentCount,
    hasUpdatedAnyAssignmentStatus,
  } = input;

  const isAdminAnywhere = memberships.some((m) => m.role === "ADMIN");
  const isProjectAuthorAnywhere = memberships.some((m) =>
    PROJECT_AUTHOR_ROLES.includes(m.role)
  );
  const isStaffAnywhere = memberships.some((m) => STAFF_ROLES.includes(m.role));

  const adminTeam = pickFirst(memberships, (m) => m.role === "ADMIN");
  const projectAuthorTeam = pickFirst(memberships, (m) =>
    PROJECT_AUTHOR_ROLES.includes(m.role)
  );
  const staffTeam = pickFirst(memberships, (m) => STAFF_ROLES.includes(m.role));

  // Among teams the user can act in for project creation, find one with a project.
  const projectAuthorTeamWithProject = pickFirst(
    memberships,
    (m) =>
      PROJECT_AUTHOR_ROLES.includes(m.role) && m.team.projects.length > 0
  );

  // Among staff teams, find a project to drop into; prefer one with a rehearsal.
  const staffTeamWithRehearsal = pickFirst(
    memberships,
    (m) =>
      STAFF_ROLES.includes(m.role) &&
      m.team.projects.some((p) => p.rehearsals.length > 0)
  );
  const staffTeamWithProject = pickFirst(
    memberships,
    (m) => STAFF_ROLES.includes(m.role) && m.team.projects.length > 0
  );

  // Pick the best "leave-note" deep link: most relevant rehearsal if one exists,
  // otherwise nudge them to a project (where they'd create a rehearsal first).
  const leaveNoteHref = (() => {
    if (staffTeamWithRehearsal) {
      const project = staffTeamWithRehearsal.team.projects.find(
        (p) => p.rehearsals.length > 0
      );
      const rehearsalId = project?.rehearsals[0]?.id;
      if (rehearsalId) return `/rehearsals/${rehearsalId}`;
    }
    if (staffTeamWithProject) {
      const projectId = staffTeamWithProject.team.projects[0]?.id;
      if (projectId) return `/projects/${projectId}`;
    }
    if (staffTeam) return `/teams/${staffTeam.team.id}`;
    return "/dashboard";
  })();

  const createRehearsalHref = (() => {
    if (staffTeamWithProject) {
      const projectId = staffTeamWithProject.team.projects[0]?.id;
      if (projectId) return `/projects/${projectId}`;
    }
    if (staffTeam) return `/teams/${staffTeam.team.id}`;
    return "/dashboard";
  })();

  const projectAuthorTeamHasProject = Boolean(projectAuthorTeamWithProject);
  const staffTeamHasRehearsal = Boolean(staffTeamWithRehearsal);

  const steps: ChecklistStep[] = [
    {
      key: "join-team",
      title: "Create or join a team",
      description: "Teams are workspaces for cast and crew.",
      href: "/dashboard",
      done: memberships.length >= 1,
      visible: true,
    },
    {
      key: "invite-teammate",
      title: "Invite a teammate",
      description: "Add cast members so your notes have someone to land on.",
      href: adminTeam ? `/teams/${adminTeam.team.id}` : "/dashboard",
      done: hasInvitedOrSecondMember,
      visible: isAdminAnywhere,
    },
    {
      key: "add-project",
      title: "Create your first project",
      description: "Projects group rehearsals for a single piece.",
      href: projectAuthorTeam
        ? `/teams/${projectAuthorTeam.team.id}`
        : "/dashboard",
      done: projectAuthorTeamHasProject,
      visible: isProjectAuthorAnywhere,
    },
    {
      key: "create-rehearsal",
      title: "Add a rehearsal",
      description: "Upload a video so you can start dropping feedback on it.",
      href: createRehearsalHref,
      done: staffTeamHasRehearsal,
      visible: isStaffAnywhere,
    },
    {
      key: "leave-note",
      title: "Leave your first note",
      description: "Drop a text or voice note at any moment in the video.",
      href: leaveNoteHref,
      done: hasAuthoredNote,
      visible: isStaffAnywhere,
    },
    {
      key: "check-inbox",
      title: "Check your inbox",
      description: "Feedback assigned to you lives in My notes.",
      href: "/my-notes",
      done: hasUpdatedAnyAssignmentStatus,
      visible: myAssignmentCount >= 1,
    },
  ];

  return steps;
}

export function checklistVisibleSteps(steps: ChecklistStep[]): ChecklistStep[] {
  return steps.filter((step) => step.visible);
}

export function checklistIsComplete(steps: ChecklistStep[]): boolean {
  const visible = checklistVisibleSteps(steps);
  return visible.length > 0 && visible.every((step) => step.done);
}

import type { TeamRole } from "@/generated/prisma/client";

export type TeamRowData = {
  id: string;
  name: string;
  role: TeamRole;
  projectCount: number;
  /** Most recent rehearsal date across all projects in the team. */
  lastActivityAt: Date | null;
  createdAt: Date;
  /**
   * True when this team is a personal workspace (created by the welcome
   * wizard, never had an invitation go out). The dashboard row swaps the
   * role chip for a "Personal" badge.
   */
  isPersonal: boolean;
};

export type MyNotesMetrics = {
  /** Active assignments (OPEN + IN_PROGRESS). */
  onPlate: number;
  /** Total assignments to me, regardless of status. */
  total: number;
};

export type NotesByMeMetrics = {
  total: number;
  stalled: number;
};

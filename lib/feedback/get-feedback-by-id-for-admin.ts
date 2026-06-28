import "server-only";

import type { FeedbackStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AdminFeedbackDetail = {
  id: string;
  category: "BUG" | "IDEA" | "QUESTION" | "PRAISE";
  status: FeedbackStatus;
  body: string;
  pageUrl: string;
  userAgent: string | null;
  appVersion: string | null;
  internalNotes: string | null;
  adminResponse: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  team: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  rehearsal: { id: string; title: string } | null;
};

/**
 * Loads a single feedback row for the admin detail page. Returns null
 * when the row doesn't exist (the page returns 404 in that case).
 *
 * No team-membership / role check here — the route is admin-gated at
 * the layout level via `isAppAdmin`, which guarantees the caller is
 * authorized to see anything in the table. This is structurally
 * different from `get*ForUser()` helpers (which enforce ownership) —
 * admins see all rows by definition.
 */
export async function getFeedbackByIdForAdmin(
  feedbackId: string
): Promise<AdminFeedbackDetail | null> {
  const row = await db.feedback.findUnique({
    where: { id: feedbackId },
    select: {
      id: true,
      category: true,
      status: true,
      body: true,
      pageUrl: true,
      userAgent: true,
      appVersion: true,
      internalNotes: true,
      adminResponse: true,
      respondedAt: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      rehearsal: { select: { id: true, title: true } },
    },
  });

  if (!row) return null;

  return {
    ...row,
    category: row.category as AdminFeedbackDetail["category"],
  };
}

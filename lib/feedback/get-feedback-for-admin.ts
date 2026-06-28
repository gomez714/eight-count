import "server-only";

import type { FeedbackStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AdminFeedbackRow = {
  id: string;
  category: "BUG" | "IDEA" | "QUESTION" | "PRAISE";
  status: FeedbackStatus;
  body: string;
  pageUrl: string;
  createdAt: Date;
  respondedAt: Date | null;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  team: { id: string; name: string } | null;
  project: { id: string; title: string } | null;
  rehearsal: { id: string; title: string } | null;
};

const ADMIN_LIST_CAP = 200;

/**
 * Loads feedback rows for the admin list page. No pagination in v1 —
 * 200-row cap is plenty for a beta with ~20 college dance seniors and
 * leaves headroom for a year of casual submission rate before we'd
 * need to add cursor pagination. Same cheap-hedge approach as
 * `getDiscussionsForProject` (capped at 50).
 *
 * Ordering: newest-first. Filtering by status is applied at the call
 * site (the list page reads `?status=` from searchParams).
 */
export async function getFeedbackForAdmin(
  status?: FeedbackStatus
): Promise<AdminFeedbackRow[]> {
  const rows = await db.feedback.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: ADMIN_LIST_CAP,
    select: {
      id: true,
      category: true,
      status: true,
      body: true,
      pageUrl: true,
      createdAt: true,
      respondedAt: true,
      author: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      rehearsal: { select: { id: true, title: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    // Prisma's enum type widens to all enum variants; the FeedbackCategory
    // enum on the schema side is constrained to these four values, so the
    // narrowing assertion is safe.
    category: row.category as AdminFeedbackRow["category"],
  }));
}

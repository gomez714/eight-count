import { ChevronRight, MailCheck } from "lucide-react";
import Link from "next/link";

import type { FeedbackStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getFeedbackForAdmin } from "@/lib/feedback/get-feedback-for-admin";
import { cn } from "@/lib/utils";

import { FeedbackCategoryChip } from "./feedback-category-chip";
import {
  FEEDBACK_STATUS_LABELS,
  FeedbackStatusChip,
} from "./feedback-status-chip";

/**
 * Inline relative-time helper. Matches the convention used by
 * `app/dashboard/team-row.tsx` and a few other row-style surfaces in
 * the app — keeping it inline avoids importing date-fns just for a
 * handful of usages.
 */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 1) return "just now";
  if (Math.abs(diffMin) < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 7) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

const FILTERABLE_STATUSES: FeedbackStatus[] = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "SHIPPED",
  "WONT_DO",
  "DUPLICATE",
];

type AdminFeedbackPageProps = {
  searchParams: Promise<{ status?: string }>;
};

function parseStatus(raw: string | undefined): FeedbackStatus | null {
  if (!raw) return null;
  if ((FILTERABLE_STATUSES as string[]).includes(raw)) {
    return raw as FeedbackStatus;
  }
  return null;
}

export default async function AdminFeedbackPage({
  searchParams,
}: Readonly<AdminFeedbackPageProps>) {
  const params = await searchParams;
  const activeStatus = parseStatus(params.status);

  // Two queries in parallel: the filtered list + per-status counts for
  // the pill row. groupBy keeps the count query single-roundtrip — no
  // need to fan out N count queries per status.
  const [rows, counts] = await Promise.all([
    getFeedbackForAdmin(activeStatus ?? undefined),
    db.feedback.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = new Map<FeedbackStatus, number>();
  let total = 0;
  for (const c of counts) {
    countByStatus.set(c.status, c._count._all);
    total += c._count._all;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6 flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Admin
        </span>
        <h1 className="font-heading text-2xl font-medium text-foreground">
          Feedback inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Every submission users send through the in-app feedback widget lands
          here. Reply via the detail page or directly from the email
          notification.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Filter by status">
        <FilterPill
          href="/admin/feedback"
          label="All"
          count={total}
          active={activeStatus === null}
        />
        {FILTERABLE_STATUSES.map((status) => (
          <FilterPill
            key={status}
            href={`/admin/feedback?status=${status}`}
            label={FEEDBACK_STATUS_LABELS[status]}
            count={countByStatus.get(status) ?? 0}
            active={activeStatus === status}
          />
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState activeStatus={activeStatus} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/feedback/${row.id}`}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-colors",
                  "hover:bg-muted/60",
                  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FeedbackStatusChip status={row.status} />
                    <FeedbackCategoryChip category={row.category} />
                    <span className="text-sm font-medium text-foreground">
                      {row.author.name?.trim() || row.author.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {formatRelative(row.createdAt)}
                    </span>
                    {row.respondedAt ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-[color:var(--status-addressed-fg)]"
                        title={`Replied ${formatRelative(row.respondedAt)}`}
                      >
                        <MailCheck className="size-3" aria-hidden />
                        Replied
                      </span>
                    ) : null}
                  </div>

                  <p className="line-clamp-2 text-sm text-foreground/85">
                    {row.body}
                  </p>

                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{row.pageUrl}</span>
                    {row.team ? (
                      <>
                        <span className="mx-1.5">·</span>
                        {row.team.name}
                      </>
                    ) : null}
                    {row.project ? (
                      <>
                        <span className="mx-1.5">·</span>
                        {row.project.title}
                      </>
                    ) : null}
                  </p>
                </div>

                <ChevronRight
                  className="size-4 shrink-0 self-center text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type FilterPillProps = {
  href: string;
  label: string;
  count: number;
  active: boolean;
};

function FilterPill({
  href,
  label,
  count,
  active,
}: Readonly<FilterPillProps>) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 tabular-nums",
          active
            ? "bg-primary-foreground/20"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function EmptyState({
  activeStatus,
}: Readonly<{ activeStatus: FeedbackStatus | null }>) {
  if (activeStatus !== null) {
    return (
      <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No feedback with status{" "}
          <span className="font-medium text-foreground">
            {FEEDBACK_STATUS_LABELS[activeStatus]}
          </span>{"."}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">
        No feedback yet.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        When users send feedback from the header icon, it&apos;ll land here.
      </p>
    </div>
  );
}

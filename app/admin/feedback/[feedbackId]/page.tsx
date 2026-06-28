import { ArrowLeft, ExternalLink, MailCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFeedbackByIdForAdmin } from "@/lib/feedback/get-feedback-by-id-for-admin";

import { FeedbackCategoryChip } from "../feedback-category-chip";
import { InternalNotesForm } from "./internal-notes-form";
import { ResponseForm } from "./response-form";
import { StatusControl } from "./status-control";

type AdminFeedbackDetailPageProps = {
  params: Promise<{ feedbackId: string }>;
};

function formatAbsolute(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function AdminFeedbackDetailPage({
  params,
}: Readonly<AdminFeedbackDetailPageProps>) {
  const { feedbackId } = await params;
  const feedback = await getFeedbackByIdForAdmin(feedbackId);
  if (!feedback) {
    notFound();
  }

  const authorDisplay =
    feedback.author.name?.trim() || feedback.author.email;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/admin/feedback"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to inbox
      </Link>

      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FeedbackCategoryChip category={feedback.category} />
          <StatusControl
            feedbackId={feedback.id}
            current={feedback.status}
          />
          {feedback.respondedAt ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-(--status-addressed-fg)"
              title={`Replied ${formatAbsolute(feedback.respondedAt)}`}
            >
              <MailCheck className="size-3" aria-hidden />
              Replied {formatAbsolute(feedback.respondedAt)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-medium text-foreground">
            From {authorDisplay}
          </h1>
          <p className="text-xs text-muted-foreground">
            <a
              href={`mailto:${feedback.author.email}`}
              className="font-mono text-foreground/70 hover:text-foreground"
            >
              {feedback.author.email}
            </a>
            <span className="mx-1.5">·</span>
            Submitted {formatAbsolute(feedback.createdAt)}
          </p>
        </div>
      </header>

      <section className="mb-8 flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Message
        </h2>
        <div className="whitespace-pre-wrap rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed text-foreground">
          {feedback.body}
        </div>
      </section>

      <section className="mb-8 flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Context
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
          <ContextRow label="Page">
            <span className="font-mono break-all text-foreground/80">
              {feedback.pageUrl}
            </span>
          </ContextRow>
          {feedback.team ? (
            <ContextRow label="Team">
              <Link
                href={`/teams/${feedback.team.id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {feedback.team.name}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </ContextRow>
          ) : null}
          {feedback.project ? (
            <ContextRow label="Project">
              <Link
                href={`/projects/${feedback.project.id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {feedback.project.title}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </ContextRow>
          ) : null}
          {feedback.rehearsal ? (
            <ContextRow label="Rehearsal">
              <Link
                href={`/rehearsals/${feedback.rehearsal.id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {feedback.rehearsal.title}
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </ContextRow>
          ) : null}
          {feedback.userAgent ? (
            <ContextRow label="Browser">
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show user agent</summary>
                <code className="mt-1 block break-all rounded bg-muted/60 px-2 py-1 font-mono text-[11px]">
                  {feedback.userAgent}
                </code>
              </details>
            </ContextRow>
          ) : null}
        </dl>
      </section>

      <section className="mb-8 flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Internal notes
        </h2>
        <InternalNotesForm
          feedbackId={feedback.id}
          initialValue={feedback.internalNotes}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Reply
        </h2>
        <div className="rounded-lg border bg-card px-4 py-4">
          <ResponseForm
            feedbackId={feedback.id}
            authorDisplay={authorDisplay}
            authorEmail={feedback.author.email}
            previousResponse={feedback.adminResponse}
          />
        </div>
      </section>
    </div>
  );
}

type ContextRowProps = {
  label: string;
  children: React.ReactNode;
};

function ContextRow({ label, children }: Readonly<ContextRowProps>) {
  return (
    <>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </>
  );
}

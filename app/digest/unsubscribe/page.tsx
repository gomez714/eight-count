import Link from "next/link";

import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/digest/token";

import { ResubscribeButton } from "./resubscribe-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unsubscribed — Eight Count",
  robots: { index: false },
};

type SearchParams = Promise<{ token?: string }>;

/**
 * The visible "Unsubscribe" link in every digest email lands here.
 * The page does the mutation server-side on render (idempotent) so the
 * user sees a confirmation immediately — no extra click required.
 *
 * GET-mutates-state is the accepted convention for email unsubscribe
 * links. The token is single-purpose (only flips digestEnabled) and
 * binds to one user, so the risk surface is minimal.
 */
export default async function UnsubscribePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <ResultShell
        heading="Missing token"
        body="This unsubscribe link looks incomplete. If you got here from an Eight Count email, please reply to the digest and we'll turn it off manually."
      />
    );
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return (
      <ResultShell
        heading="Invalid link"
        body="This unsubscribe link is invalid or has been tampered with. If you got here from an Eight Count email, please reply to the digest and we'll turn it off manually."
      />
    );
  }

  const user = await db.user
    .update({
      where: { id: userId },
      data: { digestEnabled: false },
      select: { id: true, email: true, digestEnabled: true },
    })
    .catch(() => null);

  if (!user) {
    return (
      <ResultShell
        heading="Account not found"
        body="We couldn't find an account for this unsubscribe link. It may have already been removed."
      />
    );
  }

  return (
    <ResultShell
      heading="You're unsubscribed"
      body={
        <>
          We won&apos;t send daily digests to{" "}
          <strong className="font-semibold text-foreground">
            {user.email}
          </strong>{" "}
          anymore. You&apos;ll still get transactional emails like team
          invitations.
        </>
      }
      footer={<ResubscribeButton token={token} />}
    />
  );
}

function ResultShell({
  heading,
  body,
  footer,
}: Readonly<{
  heading: string;
  body: React.ReactNode;
  footer?: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-[calc(100svh-60px)] items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email preferences
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{body}</p>
        {footer}
        <div className="pt-2 text-sm text-muted-foreground">
          <Link
            href="/dashboard"
            className="underline decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid"
          >
            Open Eight Count
          </Link>
        </div>
      </div>
    </main>
  );
}


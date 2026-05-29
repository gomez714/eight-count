import { NextResponse } from "next/server";

import { buildDigest } from "@/lib/digest/build-digest";
import { db } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email/send";

// Cron jobs can take a few seconds per user (Resend round-trip). For
// the beta (~30 users) this is plenty; revisit if we ever cross ~250.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MS_PER_HOUR = 60 * 60 * 1000;
const SIGNUP_GRACE_HOURS = 24;
const RECENTLY_ACTIVE_HOURS = 1;

/**
 * Daily digest cron handler. Triggered by Vercel Cron per `vercel.json`.
 *
 * Per-user pipeline:
 *   1. Skip if signed up within the last 24h (sign-up grace window).
 *   2. Skip if `updatedAt` is within the last hour — they've been in
 *      the app, no need to remind them of stuff they just saw.
 *   3. Build digest; skip if null (the load-bearing "no empty emails").
 *   4. Send via Resend.
 *   5. Bump `lastDigestSentAt` only on a successful send so retries on
 *      the next day's run still see the activity that failed to send.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron auto-
 * attaches this header when the env var is set. Manual `curl` against
 * the route must supply the same header.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[digest-cron] CRON_SECRET is not set — refusing to run.");
    return NextResponse.json({ error: "Cron disabled." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${expected}`) {
    console.warn("[digest-cron] unauthorized cron invocation");
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const signupCutoff = new Date(
    now.getTime() - SIGNUP_GRACE_HOURS * MS_PER_HOUR
  );

  const users = await db.user.findMany({
    where: {
      digestEnabled: true,
      deletedAt: null,
      createdAt: { lt: signupCutoff },
    },
    select: {
      id: true,
      email: true,
      name: true,
      updatedAt: true,
      lastDigestSentAt: true,
    },
  });

  let sent = 0;
  let skippedRecentlyActive = 0;
  let skippedEmpty = 0;
  let failed = 0;
  const recentlyActiveCutoff = new Date(
    now.getTime() - RECENTLY_ACTIVE_HOURS * MS_PER_HOUR
  );

  for (const user of users) {
    try {
      if (user.updatedAt > recentlyActiveCutoff) {
        skippedRecentlyActive += 1;
        continue;
      }

      const payload = await buildDigest({
        userId: user.id,
        lastDigestSentAt: user.lastDigestSentAt,
        now,
      });

      if (payload === null) {
        skippedEmpty += 1;
        continue;
      }

      await sendDigestEmail({
        to: user.email,
        userId: user.id,
        firstName: firstNameOf(user.name),
        payload,
      });

      await db.user.update({
        where: { id: user.id },
        data: { lastDigestSentAt: now },
      });

      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[digest-cron] send failed for user=${user.id}:`, error);
    }
  }

  console.info(
    `[digest-cron] candidates=${users.length} sent=${sent} skippedRecentlyActive=${skippedRecentlyActive} skippedEmpty=${skippedEmpty} failed=${failed}`
  );

  return NextResponse.json({
    candidates: users.length,
    sent,
    skippedRecentlyActive,
    skippedEmpty,
    failed,
  });
}

function firstNameOf(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/u)[0] ?? trimmed;
}

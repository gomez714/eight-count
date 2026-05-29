import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/digest/token";

export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe endpoint. Gmail / Apple Mail surface
 * a native "Unsubscribe" button when they see the `List-Unsubscribe`
 * + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers we set
 * in `sendDigestEmail`. Clicking that button fires a POST here.
 *
 * The visible footer link in the digest itself routes to the page at
 * `/digest/unsubscribe` (NOT this endpoint) so users see a real
 * confirmation page instead of bare JSON.
 */
export async function POST(request: Request) {
  const token = await readToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  // Idempotent — if the user is already unsubscribed (or soft-deleted)
  // we still return 200 so Gmail's one-click handler doesn't retry.
  await db.user
    .update({
      where: { id: userId },
      data: { digestEnabled: false },
    })
    .catch((error) => {
      console.warn(
        `[digest-unsubscribe] update failed for user=${userId}:`,
        error
      );
    });

  return NextResponse.json({ ok: true });
}

async function readToken(request: Request): Promise<string | null> {
  // Gmail's one-click POST sends `List-Unsubscribe=One-Click` as the
  // body (application/x-www-form-urlencoded). The token rides on the
  // URL itself, so we always read from the query string regardless of
  // body shape.
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  return token && token.length > 0 ? token : null;
}

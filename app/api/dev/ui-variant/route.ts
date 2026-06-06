import { NextRequest, NextResponse } from "next/server";

import { isUiVariant, UI_VARIANT_COOKIE } from "@/lib/ui/variant";

/**
 * Sets the UI variant cookie. Accepts a JSON body (`{ variant }`) for
 * programmatic use or a form-encoded body for the `/dev/ui` page's HTML form.
 *
 * Intentionally NOT auth-gated. The cookie controls visual variant only —
 * no data exposure, no privilege change. Internal users and testers can
 * self-serve.
 *
 * `redirect` (form-encoded only): when present, responds with a 303 to that
 *   path so the browser navigates after the cookie is set. Used by the dev
 *   page's <form action> to land the user back somewhere useful after
 *   flipping. Same-origin paths only (must start with "/", not "//").
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  let variant: string | undefined;
  let redirectTo: string | undefined;

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { variant?: unknown }
      | null;
    variant = typeof body?.variant === "string" ? body.variant : undefined;
  } else {
    const form = await request.formData().catch(() => null);
    const v = form?.get("variant");
    const r = form?.get("redirect");
    variant = typeof v === "string" ? v : undefined;
    redirectTo = typeof r === "string" ? r : undefined;
  }

  if (!isUiVariant(variant)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_VARIANT" },
      { status: 400 }
    );
  }

  // Sanitize redirect: same-origin paths only.
  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : null;

  const response = safeRedirect
    ? NextResponse.redirect(new URL(safeRedirect, request.url), 303)
    : NextResponse.json({ ok: true, variant });

  response.cookies.set(UI_VARIANT_COOKIE, variant, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return response;
}

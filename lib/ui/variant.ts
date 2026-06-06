import "server-only";

import { cookies } from "next/headers";

/**
 * UI variant flag. Cookie-backed so a tester (or the author) can opt into
 * the in-progress redesign of a given surface without a schema change.
 *
 * Currently only `/dashboard` reads this — `"v2"` renders the activity-led
 * redesign; anything else renders the V1 dashboard. Other surfaces (e.g.
 * `/my-notes`) will read the same flag when their respective rewrites land.
 *
 * Cookie set by `POST /api/dev/ui-variant`. See `app/dev/ui/page.tsx` for
 * the human-facing toggle.
 */

export const UI_VARIANT_COOKIE = "ec_ui_variant";

export type UiVariant = "v1" | "v2";

const VALID_VARIANTS = new Set<UiVariant>(["v1", "v2"]);

export function isUiVariant(value: string | undefined): value is UiVariant {
  return value !== undefined && VALID_VARIANTS.has(value as UiVariant);
}

/**
 * Server-only: resolves the current viewer's UI variant by reading the
 * cookie. Defaults to `"v1"` (current production UI) when unset or invalid.
 *
 * Safe to call from any Server Component or Route Handler; never throws.
 */
export async function getUiVariant(): Promise<UiVariant> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(UI_VARIANT_COOKIE)?.value;
  return isUiVariant(raw) ? raw : "v1";
}

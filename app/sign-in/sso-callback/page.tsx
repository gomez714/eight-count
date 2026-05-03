"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * OAuth landing page. Clerk redirects users here after a successful OAuth
 * authentication (Google, etc.). `<AuthenticateWithRedirectCallback />`
 * processes the auth state and forwards the user to the
 * `redirectUrlComplete` we passed when initiating the OAuth flow.
 *
 * No layout — just a centered loader so the user sees something during the
 * brief processing window.
 */
export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <span
          aria-hidden
          className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
        />
        Completing sign-in…
      </div>

      <AuthenticateWithRedirectCallback />
    </div>
  );
}

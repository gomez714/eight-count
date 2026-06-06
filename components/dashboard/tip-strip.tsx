"use client";

import { Sparkles, X } from "lucide-react";
import { useState, useTransition } from "react";

import { dismissTipGroupAction } from "@/app/dashboard/onboarding-actions";

/**
 * First-session tip strip. Dismissable; persists the dismissal in
 * `onboardingState.tipsDismissed.dashboard` via `dismissTipGroupAction`.
 *
 * Rendered in V2 only when (a) the user hasn't dismissed it and (b) the
 * dashboard is showing the feed (skipped on quiet-week, welcome, and
 * brand-new states where extra chrome would compete with the empty-state
 * message).
 *
 * Optimistic: hides immediately on click and reconciles via the server
 * action. If the action fails, the strip re-renders on the next page
 * navigation (the underlying state is the source of truth).
 */

type TipStripProps = {
  /** Copy shown in the strip. */
  children: React.ReactNode;
};

export function TipStrip({ children }: Readonly<TipStripProps>) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  const handleDismiss = () => {
    setHidden(true);
    startTransition(() => {
      void dismissTipGroupAction("dashboard");
    });
  };

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground"
      style={{
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
      }}
    >
      <Sparkles
        aria-hidden
        className="h-3.5 w-3.5 shrink-0"
        style={{ color: "var(--primary)" }}
      />
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss tip"
        className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

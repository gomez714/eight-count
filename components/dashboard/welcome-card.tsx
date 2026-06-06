import { Upload, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { FrameThumb } from "./frame-thumb";

/**
 * Brand-new user state — viewer has zero teams. The dashboard's entire
 * surface is just this card: a warm welcome, two CTAs (set up first
 * rehearsal, create a team), and a calm sublink reminding them solo
 * use is fine. No meta line, no feed, no teams strip — single decision.
 *
 * The "Set up first rehearsal" CTA targets the quick-start flow that
 * skips team/project setup entirely. "Create a team" is offered as a
 * peer choice, not the primary path.
 */

type WelcomeCardProps = {
  /** Viewer's first name, when known. */
  displayName: string | null;
  /** Route the primary CTA targets. Defaults to the quick-start. */
  primaryHref?: string;
  /** Route the secondary CTA targets. Defaults to dashboard create-team. */
  secondaryHref?: string;
};

export function WelcomeCard({
  displayName,
  primaryHref = "/welcome",
  secondaryHref = "/dashboard#teams",
}: Readonly<WelcomeCardProps>) {
  return (
    <section
      aria-label="Welcome"
      className="flex flex-col gap-5 rounded-2xl p-5"
      style={{
        background: "var(--surface-canvas)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Getting started
        </p>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          Welcome to Eight Count,{" "}
          <span className="text-foreground">{displayName ?? "there"}</span>.
        </h1>
        <p className="text-[14px] leading-snug text-muted-foreground">
          Eight Count is where rehearsal feedback lives. Start with a run —
          then leave notes, and invite the people you dance with.
        </p>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl">
        <FrameThumb
          rehearsalId="welcome"
          ms={0}
          tone="teal"
          caption={false}
          aspect="16 / 9"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <CTAButton href={primaryHref} primary icon={<Upload className="h-4 w-4" />}>
          Set up your first rehearsal
        </CTAButton>
        <CTAButton href={secondaryHref} icon={<Users className="h-4 w-4" />}>
          Create a team for your cast
        </CTAButton>
      </div>

      <p className="px-1 text-[12px] text-muted-foreground">
        Working solo is fine — you can add a team later.
      </p>
    </section>
  );
}

type CTAButtonProps = {
  href: string;
  primary?: boolean;
  icon: ReactNode;
  children: ReactNode;
};

function CTAButton({
  href,
  primary,
  icon,
  children,
}: Readonly<CTAButtonProps>) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          : "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-[14px] font-semibold text-foreground transition-colors hover:bg-(--surface-sunken) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
    >
      {icon}
      {children}
    </Link>
  );
}

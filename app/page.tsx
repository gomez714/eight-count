import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import {
  Check,
  Globe,
  MessageSquare,
  Mic,
  Repeat,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { LandingAvatar, type AvatarTone } from "./landing/primitives/avatar-initials";
import { LandingDancerQueueCard } from "./landing/primitives/dancer-queue-card";
import { LandingDrillRowMock } from "./landing/primitives/drill-row-mock";
import { LandingMobileHero } from "./landing/primitives/landing-mobile-hero";
import { LandingNav } from "./landing/primitives/landing-nav";
import { LandingProductCollageHero } from "./landing/primitives/product-collage-hero";
import { LandingTextNoteCard } from "./landing/primitives/text-note-card";
import { LandingVideoFrame } from "./landing/primitives/video-frame";
import { LandingVoiceNoteCard } from "./landing/primitives/voice-note-card";

export default async function Page() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    // The landing redesign is light-mode only — `force-light` re-declares
    // every dark-overridden token on this subtree so the warm cream + dark-
    // cinema CTA composition resolves correctly even when the user has the
    // app set to dark mode. See `.force-light` in app/globals.css.
    // TODO: author dark-mode variants for the landing redesign and drop
    // the wrapper.
    <main
      className="force-light flex flex-col bg-background text-foreground"
      style={{ background: "var(--surface-canvas)" }}
    >
      <LandingNav />
      <Hero />
      <ProblemSection />
      <HowItWorksSection />
      <TwoViewsSection />
      <FeaturesSection />
      <RolesSection />
      <BuiltForTrustSection />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}

// ----------------------------------------------------------------------------
// HERO
// ----------------------------------------------------------------------------

function Hero() {
  return (
    <section
      className="relative"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {/* Soft radial wash in opposing corners — gives the editorial spread
          feel without overpowering the foreground content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 95% 8%, oklch(0.96 0.04 30 / 0.6), transparent 60%), radial-gradient(ellipse 40% 50% at 0% 90%, oklch(0.96 0.04 220 / 0.55), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-16 lg:pt-16 lg:pb-20">
        <div className="flex flex-col gap-6">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full font-bold tracking-wider uppercase text-muted-foreground"
            style={{
              fontSize: 11,
              padding: "5px 11px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: "var(--primary)" }}
            />
            For dance teams who give notes that need to land
          </span>

          <h1
            className="font-serif text-foreground"
            style={{
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1.02,
              fontSize: "clamp(48px, 9vw, 80px)",
            }}
          >
            Notes that{" "}
            <em style={{ color: "var(--primary)" }}>land</em>.
            <br />
            <span
              className="italic"
              style={{ color: "var(--note-voice-accent)" }}
            >
              And stay landed.
            </span>
          </h1>

          <p
            className="text-muted-foreground"
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              maxWidth: 500,
              textWrap: "pretty",
            }}
          >
            Eight Count anchors every correction to the second of rehearsal
            it&rsquo;s about — and tracks each dancer&rsquo;s progress through
            their notes, one by one.
          </p>

          <div className="mt-1 flex w-full flex-wrap items-center gap-2.5 sm:inline-flex sm:w-auto">
            <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
              <button
                type="button"
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-full font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
                style={{
                  background: "var(--foreground)",
                  color: "var(--background)",
                  padding: "13px 22px",
                  fontSize: 14,
                }}
              >
                Get started — free in beta
              </button>
            </SignUpButton>

            {/*
              TODO: re-enable the "60-second tour" button when the demo
              video is recorded. Intended behavior: opens a modal or
              external link with a short walkthrough. Keeping the markup
              here so the eventual wiring is a 30-second job.

              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full font-medium text-foreground transition-colors hover:bg-muted"
                style={{
                  padding: "13px 18px",
                  fontSize: 14,
                  border: "1px solid var(--border)",
                  background: "transparent",
                }}
              >
                <Play className="size-3" fill="currentColor" strokeWidth={0} />
                60-second tour
              </button>
            */}
          </div>

          <div
            className="mt-4 inline-flex items-center gap-3.5 pt-4"
            style={{
              borderTop: "1px solid var(--border)",
              maxWidth: 500,
            }}
          >
            <div className="inline-flex">
              <LandingAvatar initials="MR" tone="teal" size={26} />
              <LandingAvatar
                initials="TO"
                tone="coral"
                size={26}
                style={{ marginLeft: -8 }}
              />
              <LandingAvatar
                initials="LV"
                tone="plum"
                size={26}
                style={{ marginLeft: -8 }}
              />
              <LandingAvatar
                initials="SC"
                tone="olive"
                size={26}
                style={{ marginLeft: -8 }}
              />
            </div>
            <p
              className="text-muted-foreground"
              style={{ fontSize: 12.5, lineHeight: 1.4 }}
            >
              Shaped by interviews with college, conservatory and company
              choreographers.
              <br />
              Private by default — videos never used to train AI.
            </p>
          </div>
        </div>

        {/* Product collage splits by viewport. Mobile gets a phone-
            anchored composition that shows the dancer's queue + a voice
            peek over the rehearsal video; desktop gets the editorial
            rotated-card collage. Switching at `sm:` (640px) — anything
            below that, the rotated desktop cards overlap too aggressively
            and lose the visual punchline. */}
        <div className="block sm:hidden">
          <LandingMobileHero />
        </div>
        <div className="hidden sm:block">
          <LandingProductCollageHero />
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// PROBLEM
// ----------------------------------------------------------------------------

function ProblemSection() {
  return (
    <section
      className="relative px-5 py-16 text-center sm:px-8 sm:py-20"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <p
        className="mx-auto font-serif text-foreground"
        style={{
          maxWidth: 760,
          fontSize: "clamp(22px, 3.4vw, 32px)",
          lineHeight: 1.3,
          letterSpacing: "-0.015em",
          fontWeight: 400,
        }}
      >
        The note you give Tuesday gets buried by Wednesday. The dancer who
        needed it is still scrolling for it on Friday.{" "}
        <span className="text-muted-foreground">
          Feedback dies somewhere between the rehearsal floor and the group
          chat — not because anyone stopped caring, but because the medium
          wasn&rsquo;t built for the work.
        </span>
      </p>
    </section>
  );
}

// ----------------------------------------------------------------------------
// HOW IT WORKS
// ----------------------------------------------------------------------------

function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20 lg:px-16"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-9">
          <Eyebrow>How it works</Eyebrow>
          <SerifH2>
            Three steps.{" "}
            <span className="text-muted-foreground">
              The follow-through wasn&rsquo;t possible before.
            </span>
          </SerifH2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StepCard
            n="01"
            title="Upload the rehearsal video"
            body="Mp4, mov, or webm. Lives in secure storage; only your team can see it. Signed URLs expire in 60 minutes — links can't leak."
            visual={
              <div
                className="overflow-hidden rounded-lg"
                style={{ border: "1px solid var(--border)" }}
              >
                <LandingVideoFrame variant="default" notes={[]} />
              </div>
            }
          />
          <StepCard
            n="02"
            title="Drop notes at the moment"
            body="Type a thought or hit record for a voice note. Each note pins to its timestamp and routes to the cast, a group, or a single dancer."
            visual={
              <div className="flex flex-col gap-2">
                <LandingTextNoteCard
                  raised={false}
                  body="Front line — arms early on &-5. Hold until the snap."
                  audience={[{ kind: "GROUP", label: "Front line", count: 4 }]}
                  assignments={[]}
                  tag="Timing"
                />
                <LandingVoiceNoteCard
                  raised={false}
                  showTranscript={false}
                  audience={[{ kind: "USER", label: "Iris T." }]}
                  assignments={[]}
                />
              </div>
            }
          />
          <StepCard
            n="03"
            title="Watch progress, not promises"
            body="Every dancer's status on every note is its own row. See who's addressed, who's working, and who's stuck."
            visual={<LandingDrillRowMock />}
          />
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// TWO VIEWS
// ----------------------------------------------------------------------------

function TwoViewsSection() {
  return (
    <section
      id="two-views"
      className="scroll-mt-20 px-5 py-16 sm:px-8 sm:py-20 lg:px-16"
      style={{
        background: "var(--surface-sunken)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-9">
          <Eyebrow>Built for both sides of the room</Eyebrow>
          <SerifH2>
            You give the note.{" "}
            <span
              className="italic"
              style={{ color: "var(--note-voice-accent)" }}
            >
              They actually work it.
            </span>
          </SerifH2>
          <p
            className="mt-3 text-muted-foreground"
            style={{ fontSize: 16, maxWidth: 600, textWrap: "pretty" }}
          >
            One note for the front line tracks each dancer separately. Status,
            reactions, replies — synced between both views.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div id="for-instructors" className="scroll-mt-20">
            <p
              className="mb-3 font-bold tracking-wider uppercase"
              style={{ color: "var(--primary)", fontSize: 11 }}
            >
              ◦ Instructor view — Maya R.
            </p>
            <LandingTextNoteCard
              body="Iris — second pirouette landed off-axis. Spot the back wall, not the camera."
              audience={[{ kind: "USER", label: "Iris Tan" }]}
              assignments={[
                { initials: "IT", tone: "teal", status: "IN_PROGRESS" },
              ]}
              tag="Technique"
              author="T. Okafor"
              authorTone="coral"
            />
          </div>
          <div id="for-dancers" className="scroll-mt-20">
            <p
              className="mb-3 font-bold tracking-wider uppercase lg:text-right"
              style={{ color: "var(--note-voice-accent)", fontSize: 11 }}
            >
              Dancer view — Iris ◦
            </p>
            <LandingDancerQueueCard
              forName="Iris"
              rows={[
                {
                  ms: 47000,
                  type: "TEXT",
                  body: "Second pirouette — spot the back wall, not the camera.",
                  status: "IN_PROGRESS",
                  tag: "Technique",
                },
                {
                  ms: 14500,
                  type: "TEXT",
                  body: "Arms early on the &-5. Hold until the snap.",
                  status: "ADDRESSED",
                  tag: "Timing",
                },
                {
                  ms: 72400,
                  type: "VOICE",
                  body: "Count the &-a-7. Plant on 7, breathe on 8.",
                  status: "OPEN",
                  tag: "Musicality",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// FEATURES
// ----------------------------------------------------------------------------

function FeaturesSection() {
  return (
    <section
      className="px-5 py-16 sm:px-8 sm:py-20 lg:px-16"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-9">
          <Eyebrow>What makes it different</Eyebrow>
          <SerifH2>Built for the way notes actually flow in a room.</SerifH2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FeatureCard
            accent="voice"
            icon={<Mic className="size-4" />}
            title="Voice notes that play in sync"
            body="Hit play and the rehearsal video plays alongside the audio — your dancer sees and hears the moment together. Auto-transcribed."
          />
          <FeatureCard
            accent="primary"
            icon={<Users className="size-4" />}
            title="One status per dancer, per note"
            body="A note for the front line tracks each dancer separately. No more &ldquo;who saw this?&rdquo; — you see exactly who's on it."
          />
          <FeatureCard
            accent="primary"
            icon={<Globe className="size-4" />}
            title="Targeted audiences"
            body="Full cast, named groups (Front line, Soloists), individuals — or any combination. Dancers only see what they're meant to see."
          />
          <FeatureCard
            accent="plum"
            icon={<Repeat className="size-4" />}
            title="Repeating-correction signals"
            body="When a dancer keeps slipping on the same tag — timing, spacing, energy — Eight Count flags it. Triage what's actually slipping."
          />
          <FeatureCard
            accent="primary"
            icon={<MessageSquare className="size-4" />}
            title="Discussions, separate from notes"
            body="Creative back-and-forth (&ldquo;what quality here?&rdquo;) lives in its own thread. Dancers can author. No status pressure."
          />
          <FeatureCard
            accent="primary"
            icon={<Check className="size-4" />}
            title="Drill view for the studio"
            body="A printable per-dancer checklist that turns the week's notes into something you can run through on the floor."
          />
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// ROLES
// ----------------------------------------------------------------------------

function RolesSection() {
  return (
    <section
      className="px-5 py-16 sm:px-8 sm:py-20 lg:px-16"
      style={{
        background: "var(--surface-sunken)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-9">
          <Eyebrow>For everyone in the room</Eyebrow>
          <SerifH2>
            Different roles. Different views.{" "}
            <span className="text-muted-foreground">
              Same source of truth.
            </span>
          </SerifH2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RoleCard
            role="ADMIN"
            tone="slate"
            body="Runs the team. Invites members, sets up projects, sees everything."
          />
          <RoleCard
            role="INSTRUCTOR"
            tone="teal"
            body="Runs rehearsals. Creates projects, manages cast groups, leaves notes."
          />
          <RoleCard
            role="ASSISTANT"
            tone="olive"
            body="Supports rehearsals. Uploads videos, leaves notes alongside the lead."
          />
          <RoleCard
            role="DANCER"
            tone="coral"
            body="Gets clarity. Sees what's assigned, marks each note as they work it."
          />
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// BUILT FOR TRUST
// ----------------------------------------------------------------------------

function BuiltForTrustSection() {
  return (
    <section
      className="px-5 py-16 sm:px-8 sm:py-20 lg:px-16"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-9">
          <Eyebrow>Built for trust</Eyebrow>
          <SerifH2>Your team&rsquo;s work stays in your team.</SerifH2>
          <p
            className="mt-3 text-muted-foreground"
            style={{ fontSize: 16, maxWidth: 600 }}
          >
            No public profiles, no cross-team feed, no data sold to anyone.
            Here&rsquo;s how that holds up in practice.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TrustCard
            title="Per-team workspaces"
            body="Only the people you invite see your rehearsals, notes, and recipient lists. No discoverable public layer."
          />
          <TrustCard
            title="Private media"
            body="Videos and voice recordings live in private cloud storage and only stream through 60-minute signed links — they can't be shared by URL."
          />
          <TrustCard
            title="What we won't do"
            body="We don't sell your data. Your videos are never used to train AI models. If we ever train on anonymized notes, we'll tell you first."
          />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          More detail on data handling and vendors lives on the{" "}
          <Link
            href="/privacy"
            className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            privacy page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// FINAL CTA
// ----------------------------------------------------------------------------

function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden px-5 py-20 text-center sm:px-8 sm:py-24"
      style={{
        background: "var(--cinema-bg)",
        color: "var(--cinema-fg)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 30%, oklch(0.4 0.1 220 / 0.5), transparent 60%)",
        }}
      />
      <div className="relative">
        <h2
          className="mx-auto font-serif"
          style={{
            fontWeight: 500,
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
            maxWidth: 720,
            fontSize: "clamp(36px, 6vw, 56px)",
          }}
        >
          Stop watching feedback evaporate.
          <br />
          <span
            className="italic"
            style={{ color: "oklch(0.85 0.08 220)" }}
          >
            Start watching the work hold.
          </span>
        </h2>
        <p
          className="mx-auto mt-4"
          style={{
            fontSize: 16,
            color: "var(--cinema-muted)",
            maxWidth: 540,
          }}
        >
          Eight Count is in beta. Get your team in early — it&rsquo;s free
          while we listen.
        </p>
        <div className="mt-7 mx-auto flex w-full max-w-md flex-col items-stretch gap-2.5 sm:inline-flex sm:max-w-none sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
            <button
              type="button"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-full font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              style={{
                background: "white",
                color: "var(--cinema-bg)",
                padding: "14px 24px",
                fontSize: 14,
                border: "none",
              }}
            >
              Get started — free in beta
            </button>
          </SignUpButton>
          <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
            <button
              type="button"
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-full font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              style={{
                background: "transparent",
                color: "white",
                border: "1px solid oklch(1 0 0 / 0.2)",
                padding: "14px 22px",
                fontSize: 14,
              }}
            >
              Already on a team? Sign in
            </button>
          </SignInButton>
        </div>
        <p
          className="mt-4"
          style={{ fontSize: 11.5, color: "oklch(0.72 0.02 220)" }}
        >
          For dancers 18 and over.
        </p>
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------------
// FOOTER
// ----------------------------------------------------------------------------

function SiteFooter() {
  return (
    <footer
      className="flex items-center justify-between px-5 py-6 text-muted-foreground sm:px-16"
      style={{ fontSize: 12 }}
    >
      <span>© Eight Count · in beta</span>
      <Link
        href="/privacy"
        className="rounded-sm text-foreground underline underline-offset-4 decoration-dotted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        Privacy
      </Link>
    </footer>
  );
}

// ----------------------------------------------------------------------------
// SECTION HELPERS
// ----------------------------------------------------------------------------

function Eyebrow({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p
      className="font-bold tracking-wider uppercase text-muted-foreground"
      style={{ fontSize: 11 }}
    >
      {children}
    </p>
  );
}

function SerifH2({
  children,
  style,
}: Readonly<{ children: ReactNode; style?: CSSProperties }>) {
  return (
    <h2
      className="mt-1.5 font-serif"
      style={{
        fontSize: "clamp(28px, 4vw, 36px)",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        maxWidth: 720,
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

function StepCard({
  n,
  title,
  body,
  visual,
}: Readonly<{
  n: string;
  title: string;
  body: string;
  visual: ReactNode;
}>) {
  return (
    <article
      className="flex flex-col gap-3.5 rounded-2xl"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: 20,
      }}
    >
      <div className="flex items-baseline gap-2.5">
        <span
          className="rounded-md font-semibold"
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 11,
            padding: "3px 8px",
            background:
              "color-mix(in oklch, var(--primary) 12%, transparent)",
            color: "var(--primary)",
          }}
        >
          {n}
        </span>
        <h3
          className="font-semibold"
          style={{ fontSize: 17, letterSpacing: "-0.2px" }}
        >
          {title}
        </h3>
      </div>
      <p
        className="text-muted-foreground"
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          textWrap: "pretty",
        }}
      >
        {body}
      </p>
      <div
        className="relative mt-1.5 overflow-hidden"
        style={{ height: 180 }}
      >
        {visual}
      </div>
    </article>
  );
}

type FeatureAccent = "primary" | "voice" | "plum";

const FEATURE_ACCENT_TOKENS: Record<
  FeatureAccent,
  { bg: string; fg: string; border: string }
> = {
  primary: {
    bg: "color-mix(in oklch, var(--primary) 12%, transparent)",
    fg: "var(--primary)",
    border: "var(--border)",
  },
  voice: {
    bg: "var(--note-voice-bg)",
    fg: "var(--note-voice-accent)",
    border:
      "color-mix(in oklch, var(--note-voice-accent) 22%, transparent)",
  },
  plum: {
    bg: "color-mix(in oklch, var(--repeating-fg) 12%, transparent)",
    fg: "var(--repeating-fg)",
    border: "var(--repeating-border)",
  },
};

function FeatureCard({
  icon,
  title,
  body,
  accent = "primary",
}: Readonly<{
  icon: ReactNode;
  title: string;
  body: ReactNode;
  accent?: FeatureAccent;
}>) {
  const tokens = FEATURE_ACCENT_TOKENS[accent];
  return (
    <article
      className="flex flex-col gap-3 rounded-2xl"
      style={{
        background: "var(--card)",
        border: `1px solid ${tokens.border}`,
        padding: 22,
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{
          width: 36,
          height: 36,
          background: tokens.bg,
          color: tokens.fg,
        }}
      >
        {icon}
      </span>
      <h3
        className="font-semibold"
        style={{ fontSize: 17, letterSpacing: "-0.2px" }}
      >
        {title}
      </h3>
      <p
        className="text-muted-foreground"
        style={{
          fontSize: 13.5,
          lineHeight: 1.55,
          textWrap: "pretty",
        }}
      >
        {body}
      </p>
    </article>
  );
}

function RoleCard({
  role,
  body,
  tone,
}: Readonly<{ role: string; body: string; tone: AvatarTone }>) {
  return (
    <article
      className="flex flex-col gap-2.5 rounded-xl"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: 18,
      }}
    >
      <div className="flex items-center gap-2.5">
        <LandingAvatar initials={role[0]} tone={tone} size={24} />
        <span
          className="font-bold tracking-wider uppercase"
          style={{ fontSize: 11.5 }}
        >
          {role}
        </span>
      </div>
      <p
        className="text-muted-foreground"
        style={{ fontSize: 13, lineHeight: 1.55, textWrap: "pretty" }}
      >
        {body}
      </p>
    </article>
  );
}

function TrustCard({
  title,
  body,
}: Readonly<{ title: string; body: string }>) {
  return (
    <article
      className="flex flex-col gap-2.5 rounded-2xl"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: 22,
      }}
    >
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{
          width: 36,
          height: 36,
          background:
            "color-mix(in oklch, var(--primary) 12%, transparent)",
          color: "var(--primary)",
        }}
      >
        <ShieldCheck className="size-4" />
      </span>
      <h3
        className="font-semibold"
        style={{ fontSize: 16, letterSpacing: "-0.15px" }}
      >
        {title}
      </h3>
      <p
        className="text-muted-foreground"
        style={{ fontSize: 13, lineHeight: 1.55, textWrap: "pretty" }}
      >
        {body}
      </p>
    </article>
  );
}

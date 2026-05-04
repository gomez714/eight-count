import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import {
  ArrowRight,
  Eye,
  Inbox,
  Lock,
  Mic,
  ShieldCheck,
  Target,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { NoteMockup } from "./landing/note-mockup";
import { RoleChip, type TeamRole } from "./teams/[teamId]/role-chip";

const PRIMARY_BUTTON_CLASSES =
  "inline-flex cursor-pointer items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

const PRIMARY_INLINE = { color: "var(--primary)" } as const;

export default async function Page() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-col">
      <Hero />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <RolesSection />
      <BuiltForTrustSection />
      <FinalCtaSection />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="border-b">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <span>For dance teams who give notes that need to land</span>
          </span>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Feedback that <span style={PRIMARY_INLINE}>lands</span>.
            <br />
            And <span style={PRIMARY_INLINE}>stays landed</span>.
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Eight Count anchors every note to the second of the rehearsal
            it’s about — and tracks each dancer’s progress through their
            notes, one by one.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SignUpButton forceRedirectUrl="/dashboard">
              <button type="button" className={PRIMARY_BUTTON_CLASSES}>
                Get started
              </button>
            </SignUpButton>
            <SignInButton forceRedirectUrl="/dashboard">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                Already on a team? Sign in
                <ArrowRight aria-hidden className="size-3.5" />
              </button>
            </SignInButton>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            <span
              className="font-semibold tracking-wider uppercase"
              style={PRIMARY_INLINE}
            >
              Beta
            </span>{" "}
            · designed for adult dance teams (18+) — college, conservatory,
            and professional companies.{" "}
            <Link
              href="/privacy#who"
              className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              Why?
            </Link>
          </p>
        </div>

        <div className="lg:pl-4">
          <NoteMockup />
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="text-xl leading-relaxed font-medium text-foreground sm:text-2xl">
          The note you give Tuesday gets buried by Wednesday. The dancer who
          needed it is still scrolling for it on Friday. Feedback dies
          somewhere between the rehearsal floor and the group chat — not
          because anyone stopped caring, but because the medium wasn’t built
          for the work.
        </p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col gap-10 sm:gap-14">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              How it works
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps. The kind of follow-through that wasn’t possible
              before.
            </h2>
          </div>

          <ol className="grid gap-4 lg:grid-cols-3 lg:gap-6">
            <Step
              number="01"
              title="Upload your rehearsal video"
              body="Mp4, mov, or webm. Lives in secure storage; only your team can see it."
            />
            <Step
              number="02"
              title="Drop notes at the exact moment"
              body="Type a thought or hit record for a voice note. Each note pins to the timestamp it’s about and the people it’s for."
            />
            <Step
              number="03"
              title="Watch progress, not promises"
              body="Every dancer’s status on every note is its own row. See who’s addressed, who’s working, and who’s stuck."
            />
          </ol>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="border-b bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col gap-10 sm:gap-14">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              What makes it different
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built for the way notes actually flow in a room.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Feature
              icon={<Mic aria-hidden className="size-4" />}
              title="Voice notes that play in sync with the video"
              body="Hit play and the rehearsal video plays alongside the audio — your dancer sees and hears the moment together."
              accent="voice"
            />
            <Feature
              icon={<Inbox aria-hidden className="size-4" />}
              title="One status per dancer, per note"
              body="A note for the front line tracks each dancer separately. No more “who saw this?” — you see exactly who’s on it."
            />
            <Feature
              icon={<Target aria-hidden className="size-4" />}
              title="Targeted audiences"
              body="Full cast, named groups (Front line, Soloists), individuals — or any combination. Dancers only see what they’re meant to see."
            />
            <Feature
              icon={<TimerReset aria-hidden className="size-4" />}
              title="Stalled detection, automatic"
              body="Notes older than three days with anyone still on Open or In Progress get flagged. You triage what’s actually slipping."
              accent="progress"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function RolesSection() {
  return (
    <section className="border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col gap-10 sm:gap-14">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              For everyone in the room
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Different roles. Different views. Same source of truth.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RoleCard
              role="ADMIN"
              body="Runs the team. Invites members, sets up projects, sees everything."
            />
            <RoleCard
              role="INSTRUCTOR"
              body="Runs rehearsals. Creates projects, manages cast groups, leaves notes."
            />
            <RoleCard
              role="ASSISTANT"
              body="Supports rehearsals. Uploads videos, leaves notes alongside the lead."
            />
            <RoleCard
              role="DANCER"
              body="Gets clarity. Sees what’s assigned, marks each note as they work it."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltForTrustSection() {
  return (
    <section className="border-b">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex flex-col gap-10 sm:gap-14">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Built for trust
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your team&rsquo;s work stays in your team.
            </h2>
            <p className="pt-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              No public profiles, no cross-team feed, no data sold to anyone.
              Here&rsquo;s how that holds up in practice.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TrustPoint
              icon={<Lock aria-hidden className="size-4" />}
              title="Per-team workspaces"
              body="Only the people you invite see your rehearsals, notes, and recipient lists. There&rsquo;s no discoverable public layer."
            />
            <TrustPoint
              icon={<Eye aria-hidden className="size-4" />}
              title="Private media"
              body="Videos and voice recordings live in private cloud storage and only stream through 60-minute signed links — they can&rsquo;t be shared by URL outside the app."
            />
            <TrustPoint
              icon={<ShieldCheck aria-hidden className="size-4" />}
              title="What we won&rsquo;t do"
              body="We don&rsquo;t sell your data. Your videos are never used to train AI models. If we ever train internal features on anonymized notes, we&rsquo;ll tell you first."
            />
          </div>

          <p className="text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              Read the full privacy details
            </Link>{" "}
            — including who sees what by role and a list of every vendor that
            touches your data.
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="bg-card">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop watching feedback evaporate.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Eight Count is in beta. Get your team in early — it’s free while
            we listen.
          </p>
          <SignUpButton forceRedirectUrl="/dashboard">
            <button type="button" className={PRIMARY_BUTTON_CLASSES}>
              Get started
            </button>
          </SignUpButton>
          <p className="pt-2 text-xs text-muted-foreground">
            For dancers 18 and over.
          </p>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© Eight Count · in beta</p>
        <Link
          href="/privacy"
          className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          Privacy
        </Link>
      </div>
    </footer>
  );
}

type StepProps = {
  number: string;
  title: string;
  body: string;
};

function Step({ number, title, body }: Readonly<StepProps>) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-6">
      <span
        className="inline-flex size-8 items-center justify-center rounded-full font-mono text-xs font-semibold"
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--primary) 12%, transparent)",
          color: "var(--primary)",
        }}
      >
        {number}
      </span>
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {body}
      </p>
    </li>
  );
}

type FeatureProps = {
  icon: ReactNode;
  title: string;
  body: string;
  accent?: "primary" | "voice" | "progress";
};

function Feature({
  icon,
  title,
  body,
  accent = "primary",
}: Readonly<FeatureProps>) {
  const tokens = ACCENT_TOKENS[accent];
  const cardStyle: CSSProperties | undefined =
    accent === "primary" ? undefined : { borderColor: tokens.border };
  const iconStyle: CSSProperties = {
    backgroundColor: tokens.bg,
    color: tokens.fg,
  };

  return (
    <article
      className="flex flex-col gap-3 rounded-lg border bg-background p-5 sm:p-6"
      style={cardStyle}
    >
      <span
        className="inline-flex size-8 items-center justify-center rounded-md"
        style={iconStyle}
      >
        {icon}
      </span>
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {body}
      </p>
    </article>
  );
}

const ACCENT_TOKENS: Record<
  "primary" | "voice" | "progress",
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
  progress: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
  },
};

type RoleCardProps = {
  role: TeamRole;
  body: string;
};

function RoleCard({ role, body }: Readonly<RoleCardProps>) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <RoleChip role={role} size="md" />
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

type TrustPointProps = {
  icon: ReactNode;
  title: string;
  body: string;
};

function TrustPoint({ icon, title, body }: Readonly<TrustPointProps>) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-5 sm:p-6">
      <span
        className="inline-flex size-8 items-center justify-center rounded-md"
        style={{
          backgroundColor:
            "color-mix(in oklch, var(--primary) 12%, transparent)",
          color: "var(--primary)",
        }}
      >
        {icon}
      </span>
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {body}
      </p>
    </article>
  );
}

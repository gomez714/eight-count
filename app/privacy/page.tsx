import Link from "next/link";

import { RoleChip } from "../teams/[teamId]/role-chip";

// NOTE: update this date whenever the policy changes — readers use it to
// confirm they're seeing the current version.
const LAST_UPDATED = "May 18, 2026";

// Monitored personal address. When Eight Count gets its own domain and a
// dedicated privacy@ inbox, swap this over and update the README's
// "Privacy & trust" section to drop the maintenance note.
const CONTACT_EMAIL = "lgomez00714@gmail.com";

export const metadata = {
  title: "Privacy — Eight Count",
  description:
    "How Eight Count handles your team's rehearsal videos, notes, and account data.",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-col">
      <Header />
      <Section heading="Who Eight Count is for" id="who">
        <p>
          Eight Count is currently in beta and designed for adult dancers —
          college and conservatory programs, professional companies, and adult
          studios. Account creation is limited to users{" "}
          <strong className="font-semibold text-foreground">18 or older</strong>.
        </p>
        <p>
          Why? Online services that allow younger users have to meet specific
          standards (COPPA in the US, similar regulations in other regions)
          around data collection, parental consent, and content moderation.
          We&apos;re committed to meeting those standards before we open the
          product to younger dancers — but we&apos;re not there yet, and
          we&apos;d rather wait than ship something we can&apos;t safely
          support.
        </p>
        <p className="text-muted-foreground">
          On the roadmap: parental access, age-appropriate sign-up flows, and
          the safeguards K&ndash;12 programs need.
        </p>
      </Section>

      <Section heading="What we store" id="what-we-store">
        <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
          <li>
            <strong className="font-semibold text-foreground">
              Account info
            </strong>{" "}
            — your email, display name, and profile image. These come from
            Clerk, our authentication provider.
          </li>
          <li>
            <strong className="font-semibold text-foreground">
              Team content
            </strong>{" "}
            — team and project names, rehearsal sessions, the notes you write
            (text or voice), the audience you assign each note to, and each
            recipient&apos;s status on each note. Voice notes are also
            automatically transcribed to text so they can be skimmed,
            referenced, and printed alongside text notes.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Media</strong> —
            rehearsal videos and voice recordings you upload, stored privately
            in Google Cloud Storage buckets.
          </li>
          <li>
            <strong className="font-semibold text-foreground">Activity</strong>{" "}
            — timestamps of when notes are created, edited, and addressed.
            Used to power features like the &ldquo;Notes by me&rdquo;
            dashboard and stalled-note detection.
          </li>
          <li>
            <strong className="font-semibold text-foreground">
              Email preferences
            </strong>{" "}
            — whether you&apos;ve opted in to the daily digest, and the
            timestamp of the most recent one we sent. The digest itself is a
            summary of activity you already have access to in the app; it
            never contains your videos or audio. Manage from{" "}
            <Link
              href="/settings/notifications"
              className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              email preferences
            </Link>
            , or unsubscribe one-click from any digest.
          </li>
        </ul>
      </Section>

      <Section heading="What we won't do" id="what-we-wont-do">
        <ul className="flex flex-col gap-2 pl-5 [list-style:disc]">
          <li>We won&apos;t sell your data to third parties.</li>
          <li>
            We won&apos;t use your rehearsal videos or voice recordings to
            train AI models.
          </li>
          <li>
            We won&apos;t show your team&apos;s content to anyone outside the
            team you invited them to.
          </li>
        </ul>
      </Section>

      <Section heading="What we might do — with notice" id="what-we-might-do">
        <p>
          Eight Count may eventually train internal features on anonymized
          notes and assignment activity (for example, predicting which notes
          are likely to stall, or surfacing patterns in how feedback flows
          through a rehearsal). If we do, we&apos;ll announce it before
          shipping, tell you what&apos;s used, and update this policy.
        </p>
        <p className="text-foreground/90">
          <strong className="font-semibold">Videos are excluded.</strong>{" "}
          Rehearsal videos and voice recordings are never part of any model
          training, current or future.
        </p>
      </Section>

      <Section heading="Visibility by role" id="visibility">
        <p>
          Each team is its own private workspace. Within a team,{" "}
          <strong className="font-semibold text-foreground">
            every member sees every team member&apos;s notes
          </strong>{" "}
          in their rehearsals — the role differences are about who can write,
          not who can read.
        </p>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Sees</th>
                <th className="px-4 py-3">Can write</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-3 align-top">
                  <RoleChip role="ADMIN" />
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  Everything in the team — members, pending invitations,
                  projects, rehearsals, and notes.
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  Manages members and invitations; creates projects,
                  rehearsals, and notes.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 align-top">
                  <RoleChip role="INSTRUCTOR" />
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  All team content.
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  Creates projects, rehearsals, and notes.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 align-top">
                  <RoleChip role="ASSISTANT" />
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  All team content.
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  Creates rehearsals and notes.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 align-top">
                  <RoleChip role="DANCER" />
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  Rehearsal videos and all notes (filter to &ldquo;@ me&rdquo;
                  for just yours).
                </td>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  Updates status on notes assigned to them.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          <strong className="font-semibold text-foreground">
            My notes is yours alone.
          </strong>{" "}
          The &ldquo;My notes&rdquo; inbox shows notes assigned to you and is
          visible only to you — not to your instructor, not to other dancers.
          (Authors see notes they&apos;ve sent, including your status updates,
          on their own &ldquo;Notes by me&rdquo; page.)
        </p>
        <p>
          <strong className="font-semibold text-foreground">
            Pending invitations
          </strong>{" "}
          (the email and assigned role of an invitee who hasn&apos;t accepted
          yet) are visible only to team admins.
        </p>
        <p>
          <strong className="font-semibold text-foreground">
            Across teams
          </strong>{" "}
          — nothing crosses team boundaries. Being on Team A gives you no
          visibility into Team B, even if some members of A are also in B.
        </p>
      </Section>

      <Section heading="Where your data lives" id="vendors">
        <p>
          Each vendor below receives only the data needed to perform its
          function. We pick infrastructure providers with established
          compliance postures and link to their privacy notices so you can
          verify their handling for yourself.
        </p>
        <ul className="flex flex-col gap-2.5 pl-5 [list-style:disc]">
          <li>
            <strong className="font-semibold text-foreground">Clerk</strong>{" "}
            handles authentication and account storage (email, name, profile
            image, password hashes, OAuth connections).{" "}
            <ExternalLink href="https://clerk.com/legal/privacy">
              Clerk privacy policy
            </ExternalLink>
            .
          </li>
          <li>
            <strong className="font-semibold text-foreground">
              Google Cloud Storage
            </strong>{" "}
            stores rehearsal videos and voice recordings in private buckets.
            Stored content is not used by Google to train its own models — see{" "}
            <ExternalLink href="https://cloud.google.com/terms/cloud-privacy-notice">
              Google Cloud Privacy Notice
            </ExternalLink>
            .
          </li>
          <li>
            <strong className="font-semibold text-foreground">Neon</strong>{" "}
            hosts our PostgreSQL database (everything that isn&apos;t media —
            team data, projects, rehearsals, notes, assignments, invitations).{" "}
            <ExternalLink href="https://neon.tech/privacy-policy">
              Neon privacy policy
            </ExternalLink>
            .
          </li>
          <li>
            <strong className="font-semibold text-foreground">Resend</strong>{" "}
            delivers team-invitation emails and the daily activity digest.
            The recipient&apos;s email address and the email body (which
            contains a summary of your recent activity in the app) are passed
            to Resend for the duration of sending.{" "}
            <ExternalLink href="https://resend.com/legal/privacy-policy">
              Resend privacy policy
            </ExternalLink>
            .
          </li>
          <li>
            <strong className="font-semibold text-foreground">Deepgram</strong>{" "}
            transcribes voice notes into text. Audio is sent to Deepgram&apos;s
            API for processing — see their{" "}
            <ExternalLink href="https://deepgram.com/privacy">
              privacy policy
            </ExternalLink>{" "}
            and{" "}
            <ExternalLink href="https://deepgram.com/terms">
              terms of service
            </ExternalLink>{" "}
            for their full data-handling commitments.
          </li>
        </ul>
      </Section>

      <Section heading="Your data, your control" id="control">
        <p>
          You can change your name, email, and profile image at any time
          through your account settings (Clerk).
        </p>
        <p>
          To delete your Eight Count account and the team content you own, or
          to request a copy of your data, contact us at{" "}
          <ContactLink />. We&apos;re a small team in beta — please give us up
          to 14 days to action requests.
        </p>
        <p className="text-muted-foreground">
          We&apos;re building user-initiated deletion and export flows into
          the product directly; until those ship, the email path above is the
          working channel.
        </p>
      </Section>

      <Section heading="Contact" id="contact">
        <p>
          Questions about this policy, or about how your team&apos;s data is
          handled? Email <ContactLink />.
        </p>
      </Section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <section className="border-b">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to Eight Count
        </Link>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Privacy
          </span>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How Eight Count handles your data
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated{" "}
            <time dateTime="2026-05-05">{LAST_UPDATED}</time>.
          </p>
        </div>
      </div>
    </section>
  );
}

type SectionProps = {
  heading: string;
  id: string;
  children: React.ReactNode;
};

function Section({ heading, id, children }: Readonly<SectionProps>) {
  return (
    <section id={id} className="border-b">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {heading}
        </h2>
        <div className="flex flex-col gap-3 text-base leading-relaxed text-foreground/90">
          {children}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <section className="bg-card">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Eight Count is in beta — this policy will evolve as the product
          does.
        </p>
        <Link
          href="/"
          className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          ← Back to Eight Count
        </Link>
      </div>
    </section>
  );
}

function ContactLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

function ExternalLink({
  href,
  children,
}: Readonly<{ href: string; children: React.ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
    >
      {children}
    </a>
  );
}

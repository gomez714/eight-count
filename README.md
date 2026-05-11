# Eight Count — Dance Rehearsal Feedback

A web application for choreographers to leave time-stamped text and voice feedback on rehearsal videos and track each dancer's progress through their notes.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | PostgreSQL via Prisma 7 |
| Auth | Clerk (fully headless — custom UI on top of Clerk's hooks) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) |
| Theming | CSS variables + next-themes (light / dark / system) |
| Forms | react-hook-form + Zod |
| Video / audio storage | Google Cloud Storage (signed URLs) |
| Recording | MediaRecorder API (mic-only) |
| Transcription | Deepgram (Nova-3 model, server-side) |
| Toasts | Sonner |
| Email | Resend (team invitation emails) |

## Features

### Landing & onboarding
- The **landing page** at `/` introduces the product to first-time visitors with a warm hero (headline + supporting copy + an inline mock note card built from the app's real primitives), a problem section, a three-step how-it-works flow, a four-feature grid, a role row, a **"Built for trust" section** explaining privacy and visibility, and a final CTA. The hero also carries a one-line beta-and-age disclaimer linking to `/privacy#who`. Mobile-first responsive, all built from the same tokens as the rest of the app. Footer carries a `Privacy` link.
- **Sign in** at `/sign-in` and **sign up** at `/sign-up` are **fully headless** custom routes — Clerk handles the auth logic via its hooks (`useSignIn` / `useSignUp`), but every input, button, divider, and OAuth pill is built from the app's own components.
- **Email + password** and **Google OAuth** are supported. Sign-up runs a two-step flow: enter email + password → enter the 6-digit verification code from your inbox → land on the dashboard. "Resend code" and "Use a different email" are inline.
- **18+ gate at sign-up**: a small disclaimer card sits above both the OAuth button and the email/password form with a required *"I confirm I'm 18 or older"* checkbox. Both auth paths are blocked until it's checked. The card links to `/privacy#who` for the why.
- **Deep-link preservation**: a signed-out user clicking a deep link (e.g. `/teams/abc`) is bounced to `/sign-in` by middleware and returned to that exact page after authenticating, instead of being forced into `/dashboard`.
- **Failure-mode resilience**: friendlier error messages for the common Clerk error codes (password breach, identifier conflicts, etc.); a 6-second OAuth watchdog so a hung Google sign-in doesn't leave the form frozen forever; status-branching after `signIn.create()` / `signUp.create()`; an "Already signed in?" server-side redirect on the auth pages so sessioned users never get stuck on a confusing form. Every error path logs with a `[auth]` prefix to Vercel runtime logs.
- **"Having trouble?" support link** below both forms and the verify-email step — `mailto:` link to the operator email so blocked users have an escape hatch that doesn't depend on Clerk working.
- After **sign-out**, users land on the landing page (`/`) — `<ClerkProvider afterSignOutUrl="/">`.

### Account lifecycle (soft-delete + reclaim)
- Users are **never hard-deleted** from the app's database — the foreign-key chain (notes, projects, rehearsals, assignments, invitations) makes hard delete a multi-table SQL surgery that destroys historical attribution. Instead, `User.deletedAt` marks a row as removed; the row stays so all relations remain valid, and active-member listings (team rosters, audience pickers, group memberships) filter `deletedAt IS NOT NULL` rows out.
- **Removing someone**: soft-delete the user by setting `deletedAt`. They disappear from team rosters and assignment pickers immediately. Their authored notes / existing assignments stay attributed to them — historical context isn't erased.
- **Reclaim on re-signup**: if a removed user (or one whose Clerk account was hard-deleted, orphaning their DB row) signs up again with the same email, `ensureDbUser` automatically reattaches the existing row to their new Clerk identity and clears `deletedAt`. They walk back into their notes and team memberships with no manual intervention. The operation logs `[auth] reclaiming…` so it's auditable in Vercel runtime logs.
- **Trade-off being accepted**: silent reclaim trusts email-match as proof of identity. Reasonable for a B2B beta with admin-controlled invites; a consumer-facing version would want a consent UI ("An account previously existed at this email — reclaim or start fresh?") and an audit table.

### Privacy & trust (`/privacy`)
A public privacy policy lives at `/privacy` — readable without an account. It's the canonical place where the beta's scope, data handling, and visibility model are spelled out.

- **Who Eight Count is for** — the beta is currently limited to dancers 18 and over. The page explains the *why* (children's online services have to meet specific standards we haven't built yet — COPPA, state-level under-18 protections, content moderation) and what's on the roadmap (parental access, age-appropriate flows).
- **What we store** — account info (email, name, profile image), team content (projects, rehearsals, notes, audiences, statuses), media (videos, voice recordings), activity timestamps.
- **What we won't do** — no data sale, no AI training on your videos or voice recordings, no leaking team content outside the team.
- **What we might do — with notice** — Eight Count may eventually train *internal* features (like stalled-note prediction or pattern detection) on anonymized notes and assignment activity. Videos are excluded. Anything new gets announced before it ships.
- **Visibility by role** — a 4-row table (Admin / Instructor / Assistant / Dancer) showing what each role *sees* vs. *can write*. Within a team, every member sees every team member's notes — the role differences are about who can author, not who can read. "My notes" is yours alone (no instructor visibility); pending invitations are admin-only; nothing crosses team boundaries.
- **Where your data lives** — a list of every vendor and a link to each one's privacy policy: Clerk (auth), Google Cloud Storage (media), Neon (database), Resend (invitation emails), Deepgram (voice-note transcription).
- **Your data, your control** — how to update profile info, request deletion, and contact us. (User-initiated deletion / export flows are on the roadmap; for now it's an email channel.)

The same role-visibility split is also surfaced contextually in the product — every role chip on the team page is a popover trigger that shows the role's *Sees* + *Can do* breakdown without leaving the page.

**Two top-of-file constants in [app/privacy/page.tsx](app/privacy/page.tsx) need updates over time**:
- `LAST_UPDATED` — bump whenever the policy text changes.
- `CONTACT_EMAIL` — currently the project owner's personal address (`lgomez00714@gmail.com`). Swap to a domain-hosted privacy@ inbox once Eight Count has its own domain.

### Theme toggle
- Three-state **Light / Dark / System** dropdown in the global header. Defaults to `system` on first visit (follows OS preference) and persists user choice afterward.
- Keyboard shortcut **`D`** toggles light ↔ dark.
- All design tokens (status palette, voice-note coral, avatar tones, surfaces) are defined in both `:root` and `.dark`, so every component adapts automatically — no per-component dark variants.

### Dashboard
The dashboard at `/dashboard` is the signed-in home — the only page that aggregates *across* teams.

- **Personal hero band** with a "Welcome back, {firstName}" greeting (falls back to "Welcome back" when no name is set) plus a meta strip showing total teams and your across-team "on your plate" count.
- **Onboarding checklist** sits above the work tiles for new users. See "Onboarding tour" below.
- **Work tiles**, two-up at every viewport: **My notes** shows how many assignments are active for you; **Notes by me** shows how many notes you've authored with a tinted "stalled" pill when any are stalled. The Notes-by-me tile only appears for users who are Admin / Instructor / Assistant in at least one team.
- **Your teams** as a single-column list of compact rows: team initials avatar (deterministic color), team name, "N projects · last active {relative date}" meta, role chip, chevron. Each row links to the team's organizational home.
- **+ New team** button in the section header opens a dialog with the same form used elsewhere in the app. When the user has no teams, a generous empty-state panel surfaces a "Create your first team" CTA that drops the user straight into the new workspace after creation.

### Onboarding (in-app tour)
A lightweight, dismissible tour helps new users get oriented without forcing a modal walkthrough.

- **Dashboard checklist** at the top of `/dashboard` walks through the basics — create or join a team, invite a teammate, add a project, create a rehearsal, leave your first note, check your inbox. Steps are role-gated (a pure dancer only sees "Check your inbox") and progress is **derived from real data** — once you've actually invited someone, the row checks itself off automatically. No separate per-step state to keep in sync.
- **Per-step skip**: not every step needs to happen on day one. Each pending row has a small **Skip** button that defers it without forcing the action; skipped steps still count toward completion so the bar fills and the checklist eventually clears. Skipped rows render with a dashed-circle indicator and a "tap to revisit" hint — they remain clickable, and once the underlying action is done, the data-derived "done" state takes precedence over the skip.
- **Contextual tips** appear once on the rehearsal workspace (timeline / composer / notes thread) and on `/my-notes` (Up-next hero + filter rail). Each tip is a popover anchored to a real UI element with a "Tip n of N" label, body text, and Skip / Got it buttons. Workspace tips only fire for note-authoring roles after the video URL resolves; my-notes tips only fire when the inbox has at least one note.
- **Replay**: dismissing the checklist before completion collapses it to a slim "Onboarding hidden — Show again" line on the dashboard. Clicking "Show again" clears all dismissals (including the tip-group flags) so the full tour returns. Once the checklist is fully complete and dismissed, it's gone — replay can be added back if needed.
- **Backfill for existing users**: when shipping the feature, run `npm run db:backfill-onboarding` to mark anyone with prior activity (a team membership, an authored note, or an assignment) as already onboarded so they don't see the tour. The script has a `SKIP_EMAILS` array at the top for keeping test accounts in the "show tour" state during local QA — clear it before running in production.

### Global navigation
The app header is persistent across every page (signed-in or not). The left side carries the **brand lockup** (teal "8" mark in the brand color + "Eight Count" wordmark + a subtle `AudioLines` waveform icon — wordmark and icon collapse on mobile) and a **team switcher** showing the current team's name + role chip; clicking the switcher opens a popover that lists every team you belong to (with role chip per row), navigates on selection, and provides an inline "+ Create team" footer for spinning up a new workspace without leaving the page. The current team is detected from the URL (works on `/teams/[id]`, `/projects/[id]`, and `/rehearsals/[id]`); on cross-team pages (`/dashboard`, `/my-notes`, `/notes-by-me`) the switcher reads "Switch team". The right side hosts the **theme toggle** (Light / Dark / System dropdown) plus your account dropdown when signed in (or Sign In / Sign Up buttons when signed out — both navigate to the custom auth routes via `mode="redirect"`).

> **Brand identity**: the current "8 + Eight Count + AudioLines" lockup is a v1 placeholder until a designed logo lands — all three surfaces that render brand (navbar + both auth-page brand panels) consume a single shared `<BrandLockup>` component, so the eventual logo swap is one file.

### Teams
- Create a team and invite members by email — the recipient gets a magic-link invitation regardless of whether they already have an Eight Count account.
- Assign each member a role at invite time: **Admin**, **Instructor**, **Assistant**, or **Dancer**.
- Only Admins can invite new members, resend invitations, or revoke pending ones.

### Team invitations
- Admins enter an email + role → recipient gets a branded email with an **Accept invitation** link.
- The link routes to `/invite/[token]`. If the recipient already has an account on the invited email, accepting is one click. If they don't, they're sent through `/sign-up` with the email pre-filled and locked, then bounced back to the invite page after verifying — no double accounts, no wrong-email mistakes.
- The signed-in email must match the invited email to accept (the security check). A wrong-account state explains the mismatch and routes the user through sign-out → sign-in cleanly.
- Pending invitations show up as muted rows above the active members list with an admin `…` menu (**Resend invite** rotates the token and resets the 7-day expiry, **Revoke** kills the token immediately, **Copy email**).
- Invitations expire after 7 days. Expired and revoked links land on a friendly state telling the user to ask for a new invite.

### Team page
The team page is the organizational home — it answers "who is on this team and what projects exist?" It sits above the project page in the hierarchy and is intentionally lighter and more administrative than the operational pages below it.

- **Header band** with breadcrumb (Dashboard › team), team mark, title, the viewer's role chip, and a compact meta strip showing **Members**, **Projects**, **Created**, the per-role glance (`3 admins · 2 instructors …`), and "Your role" at the end. The header carries no CTAs — primary actions live in the section headers below where they naturally belong, eliminating duplicates and quieting the top of the page.
- **Role popovers**: every role chip on the page (header, member rows) is a popover trigger. Tap any chip to see what that role can do. This replaced a persistent role glossary card and surfaces the explanation contextually instead of permanently.
- **Projects section** — the main column. Each project renders as an entry-point row (not a mini-dashboard): title, status pill, description, rehearsal count, an optional "open notes" accent (in-progress tint when there's pending work), and a relative last-activity timestamp. The list defaults to active projects; if any archived projects exist, a single inline toggle reveals or hides them (`Show archived (N)` ↔ `Hide archived`). Admins and Instructors get a `New project` button in the section header and a generous empty-state panel with a `Create first project` CTA when the team has no projects yet.
- **Members section** — sorted by role then name in a divided card list. Each row has the avatar, name + email, a "You" pill on the viewer's own row, and the member's role chip. **Admins** see a `…` overflow menu on other members' rows (currently `Copy email`; future role/remove actions slot here without redesigning the row). **Pending invitations** render in a muted block above the active members with their email, a "Pending" pill, role chip, and an admin overflow menu offering **Resend invite**, **Copy email**, and **Revoke**. The toolbar is lazy: **search** appears at ≥8 members, the **role filter** appears at ≥6 members *and* ≥3 distinct roles. Below those thresholds the section is just a clean sorted list, with a chromeless "Invite by email" footer for admins.
- **Mobile responsive**: a segmented **Projects / Members** tab switcher lets the user focus on one section at a time. The header collapses (smaller mark, role chip moved below the title to avoid orphaning, counts compressed into a single `X members · Y projects` subtitle). Page is single-column on all sizes.

### Projects (pieces / dances)
- Create projects inside a team to represent individual dances or pieces.
- Attach a description and track active vs. archived status.
- Define **project groups** (Front line, Soloists, Captains, etc.) — named subsets of the team's cast that can be targeted when leaving notes. Groups are project-scoped so cast can differ between pieces.
- Only Admins and Instructors can create, edit, or delete groups and their membership.

### Project page
The project page is the structural bridge between a team and the rehearsal workspace — it answers "what project am I in, what's its state, and what should I do next?"

- **Header band** with breadcrumb (Dashboard › team › project), title, status pill, role pill, an optional description, and primary actions: **Manage cast** *(staff only — Admin / Instructor / Assistant)* and **New rehearsal**. A meta strip below the title summarizes the project at a glance: rehearsal count, cast size, open-note count (tinted to flag work in progress vs. "all clear"), and a contributor avatar stack on desktop.
- **Repeating clusters card** *(staff only)* appears above the rehearsals spine when any dancer in the project has 3+ unresolved notes with the same tag — one tinted row per cluster (avatar, name, tag chip, "N unresolved").
- **Drill board** *(staff only)* appears below the clusters card whenever the project has any open or in-progress notes — a per-dancer collapsible list grouped by tag, useful for instructors scanning who needs to drill what across the whole company. The viewer's own row defaults expanded if they're a recipient; otherwise the dancer with the most clusters expands by default. Dancers don't see this card or the clusters card on the project page; their personal drill list lives at `/my-notes` (Drill view) instead, scoped to just their own notes.
- **Rehearsals spine** is the main column — a list of rehearsal rows sorted newest-first. Each row shows a date plate, the rehearsal title, a "Current" pill on the most recent session in projects with two or more rehearsals, video duration, total note count with a coral voice-note tally, a small contributor stack, a relative-date label, and a "Stalled" chip when at least one assigned note is older than 3 days with active recipients. A right-side progress block shows `closed / total · %` with the same four-segment stacked bar used elsewhere, plus an "All notes resolved" badge when complete.
- **Groups rail** on the right (desktop) lists the project's groups in a compact card. Admins and Instructors can create new groups inline, edit member lists, and delete groups. Empty groups get a tinted "empty" pill and an inline "Add members" CTA. Groups are the audience pool the rehearsal composer pulls from when leaving section notes.
- **Empty state**: a fresh project with no rehearsals shows a generous panel with a "Create first rehearsal" CTA pre-wired into the same dialog that the header's New rehearsal button opens.
- **Responsive layout**: on desktop the rehearsals spine and groups rail sit side-by-side. On mobile, the page condenses (smaller title, single-line meta strip, icon-only secondary action) and a segmented **Rehearsals / Groups** tab switcher lets the user focus on one at a time. Rehearsals is the default mobile tab.

### Rehearsals
- Create dated rehearsal sessions within a project.
- Upload a single rehearsal video per session (Google Cloud Storage). Only Admins, Instructors, and Assistants can upload or replace the video.
- Sessions without a video show a calm empty state: staff see an upload form embedded in it; dancers see a passive "your instructor will upload one for this session" message.
- Once a video exists, the upload form is hidden. Staff replace the video via a `…` overflow menu in the rehearsal context bar (top of the page) — selecting **Replace video** opens a dialog with the upload form. Replacing keeps existing notes and their timestamps, but dancers won't see the form themselves.

### Note tags & repeating corrections
- Every note can carry an **optional tag** from a fixed set: **Timing, Spacing, Energy, Musicality, Formation, Technique**. The composer and edit sheet expose a tag picker; tags appear as a small chip on the note row across every view.
- When the **same dancer** has **3 or more unresolved notes with the same tag** in the **same project**, those notes form a **repeating cluster**. Repeating clusters surface as a coral-violet chip per row on `/my-notes`, as an icon decoration on the recipient pip on `/notes-by-me`, and as a summary card at the top of the project page.
- Repeating detection is **derived, not stored** — the moment a dancer addresses one of the notes (or the cluster drops below three active assignments), the cluster disappears. No state to maintain, no manual cleanup.
- Tags are optional. Untagged notes don't participate in repeating detection. Authors can change a note's tag from the edit sheet at any time.

### Rehearsal workspace
The rehearsal page is a sticky two-column workspace anchored at the top by a context bar (team / project / rehearsal breadcrumb, title, role pill, and rehearsal meta).

- **Left rail (sticky):**
  - **Stage-plate video** — dark gradient frame around the rehearsal video with a custom transport (play / pause toggle, ±5s seek, mono time display) and on-frame overlays for the file watermark and current time.
  - **Timeline card** — a 48-bucket density strip showing where notes cluster, a scrubbable track with note markers (coral for voice, teal for text), a playhead, and time ticks. Click any marker to jump the playhead to that note.
- **Right column:**
  - **Progress spine** — aggregate per-recipient progress across all notes: an "X / Y addressed-or-resolved" headline, open and in-progress counts, and a four-segment stacked bar broken down by `OPEN / IN_PROGRESS / ADDRESSED / RESOLVED`.
  - **Filter pills** — single-select pills: `All / Open / In progress / Addressed / Resolved / Unassigned / Voice / @ me`, plus a separate dropdown to filter by an arbitrary assignee. Pills show a precomputed count when inactive; a "Showing X of Y" indicator reflects the result set.
  - **Note thread** — each note row has a fixed timestamp rail (clickable to jump the video), a coral or teal accent stripe distinguishing voice from text, the author + audience chips, the body (text or voice waveform), and a dashed-divider "Assigned" row of avatar + name + status-dot + status-label chips per recipient.
  - **Composer** — a sub-bar with the Text / Voice mode toggle, a "To" audience picker (popover: full-cast quick-pick, groups, individuals, removable chips), an optional **Tag** picker, and a locked-timestamp pill that re-captures the current playhead when clicked. Body morphs between a 2-row textarea + Post button (text mode) and the voice recorder (voice mode). On **desktop** (≥1024px) the composer is a sticky card at the bottom of the right column. On **mobile** (<1024px) the same composer body lives inside a peekable bottom sheet — see "Mobile composer sheet" below.

#### Mobile composer sheet
Below the `lg:` breakpoint the composer wraps in a [Vaul](https://vaul.emilkowal.ski/)-based bottom sheet with two snap points: an **80-pixel peek bar** (always visible above the system nav) and a **28vh expanded** state (tuned tight so there's no dead popover space above the iOS keyboard once Vaul lifts the sheet on textarea focus). Both shells share the same internal `ComposerBody` component, so mode toggles, audience picker, tag picker, voice recorder, etc. are byte-identical to desktop — only the surrounding shell differs.

- **Peek row** is a single horizontal strip showing the current state: a compact mode toggle (Text / Voice icons), a tap-to-recapture timestamp pill, an audience chip ("To: Front line"), and a "Tap to write…" / "Tap to record…" affordance with a chevron-up. Each is its own `<button>` with an `aria-label` so screen readers announce them distinctly. Buttons are sized 36px tall — larger than the desktop sub-bar's 28px to suit thumb taps.
- **Tap interactions from peek**:
  - **Timestamp pill** → recaptures the current playhead, *stays in peek* (the most common adjustment doesn't require a full expansion).
  - **Audience chip** → expands the sheet AND opens the audience picker pre-opened (both setState calls batch).
  - **Mode toggle** → swaps mode but doesn't expand. Suppressed during recording (would unmount the recorder mid-take).
  - **"Tap to write/record…" / chevron** → expands to the single 28vh snap.
- **Sheet behaviors**:
  - **Non-modal** (`modal={false}`) — the page underneath stays interactive. The user can scroll the notes thread, tap notes, scrub the timeline while the sheet is in peek.
  - **Non-dismissible** (`dismissible={false}`) — peek is the floor; drag-down past it bounces back to peek instead of disappearing entirely.
  - **Auto-collapse on success**: a successful text submit (detected via the `isPending` true → false transition with empty text) or voice save snaps back to peek automatically.
  - **Recording lock**: while the voice recorder is in countdown or recording (not while saving/uploading), drag-down attempts and mode toggles are bounced — the sheet stays at the expanded snap until the user explicitly cancels or saves.
- **iOS keyboard**: Vaul's built-in `repositionInputs` handles the keyboard via `visualViewport` (iOS 16.4+), lifting the sheet above the keyboard when the textarea focuses. The 28vh snap is tuned tight so the lifted sheet sits flush above the keyboard with no wasted background between the input and the keyboard top.

#### Contextual sticky video (mobile)
On mobile, the rehearsal video pins to the top of the viewport whenever it's actively in use — not always (which would waste 25–30vh permanently), not never (which would force the user to scroll back up to reference the video). The video pins on **any** of four signals being active:

1. A voice note is sync-playing (existing — the video seeks and plays alongside the audio so the user can keep watching while scrolling).
2. The user tapped a timestamp pill on any note in the last ~10 seconds (so the user can see what they jumped to while continuing to read).
3. The video is actively playing.
4. The mobile composer sheet is expanded (text or voice mode).

When all four signals are inactive, the video scrolls away normally. The CSS mechanism is the same `max-lg:sticky max-lg:top-0` pattern that already existed; the change is the trigger expanding from a single signal (voice sync) to four.
- **Audience targeting** for each note:
  - **Full cast** — one click notifies every team member.
  - **Group** — select one or more project groups (e.g. "Front line"); union semantics allow mixing groups and individuals.
  - **Individual members** — pick any combination of team members.
  - Leave empty for an unassigned general note. The audience-picker popover shows a live "Will notify N people" count as you build the selection.
- Only Admins, Instructors, and Assistants can author notes. Dancers see the video and their own notes but cannot create new ones.
- Authors can edit body / start / end timestamps and audience, or delete their own notes; audience changes diff-preserve dancers' existing statuses, and dancers see an "Edited" indicator on `/my-notes`.

### Voice notes
- Click **Voice** in the composer's mode toggle, then **Start recording**. The video pauses, a 3-second countdown runs (cancelable), then the video resumes muted while the mic captures up to 2 minutes of audio.
- The recording's `startTimestampMs` is the video position when the countdown ends; `endTimestampMs` is captured when the author clicks Stop (or the 2-minute cap auto-stops). The video is paused at the end position so the author can see where the take wraps up.
- The preview UI is a coral-tinted player (decorative-bar waveform, play / pause button, current-time / total-time mono display) wired to play **in sync with the video**: the video rewinds to the recording's start and plays alongside the audio so the author can confirm alignment before saving. **Re-record** discards the blob without uploading; **Save** uploads the audio to Google Cloud Storage via signed URL and creates the note.
- Saved voice notes use the same decorative-bar player throughout the app. In the rehearsal workspace it runs in sync mode (video seeks to the recording start, mutes, and plays alongside the audio); on `/my-notes` and `/notes-by-me` the audio plays standalone. Manually pausing the video also pauses the audio in sync mode.
- On mobile, the rehearsal video pins to the top of the viewport during synced voice playback so the user can keep watching while scrolling further down the notes thread. (Synced playback is one of four sticky-video triggers — see "Contextual sticky video" under the Rehearsal workspace section above.)
- To replace the audio of an existing voice note, delete it and record a new one — voice-note edits cover timestamps, tag, and audience only.
- Recording requires Chrome, Firefox, or recent Safari (MediaRecorder support). The mic format is auto-detected: webm/opus on Chrome/Firefox, mp4/AAC on Safari.

### Voice note transcription
- Every saved voice note is **automatically transcribed to text** by Deepgram (Nova-3 model, English) so the same recording can be skimmed, drilled on, and printed alongside text notes.
- Transcription happens **after** the user's save flow — the upload returns immediately and Deepgram runs in the background. The transcript usually lands within 5–15 seconds and shows up under the player as a collapsible "Show transcript ▾" disclosure that opens to the text in a soft accent-tinted box.
- While transcription is in progress, the disclosure is replaced with a muted "Transcribing voice note…" line that polls every 3 seconds for completion (60-second ceiling, then asks the user to refresh). On terminal failure, the line reads "Transcript unavailable" — staff (Admin / Instructor / Assistant) get a "Try again" button next to it; dancers don't (one retry per failure, no per-user retry storms).
- **Drill view gets the biggest UX win**: voice notes used to render as a `[Voice note · 0:32]` placeholder in the read-only drill checklist, useless for offline study. With transcripts available, the drill row now renders the transcript text inline — the same transcript on print, in single-line truncated form on screen. This makes drill mode actually printable and bringable to the studio without headphones.
- Privacy: the privacy page lists Deepgram in the vendor section and links to their public policy / terms instead of paraphrasing — so the public claim doesn't drift if Deepgram updates their commitments.

### My notes (recipient inbox + drill view)
- Every dancer has a personal work queue at `/my-notes` listing every note assigned to them across all rehearsals and teams.
- A **view toggle** at the top of the page flips between **Inbox** (the default working surface) and **Drill view** (a printable, tag-grouped checklist for actually rehearsing against). The choice persists in the URL via `?view=drill`.
- **Inbox layout**: a **left rail** with an "On your plate" count, a status breakdown, and From / Project / Tag / Type filters; a **queue** with an "Up next" hero card on top followed by collapsible status groups (Open, In progress, Addressed, Resolved).
- "**Up next**" surfaces the **oldest unresolved** note (Open or In progress) so the dancer always knows what's been waiting longest. If a filter is applied, the hero updates to honor it.
- Each card has an inline **status segmented control** (Open / In progress / Addressed / Resolved) — one click changes status, no dropdown — plus an "Open in rehearsal" link, the author's avatar, audience context chips ("Full cast", group, or "You"), an optional **Tag chip**, an optional **Repeating chip** (when this assignment is part of a cluster), and an "Edited" indicator if the note has been modified since creation.
- The left-rail filters narrow the queue: pick one author, one project, one tag, or text vs. voice (each is a single-select toggle; clicking again clears it). The "On your plate" count updates with the filter; the filter-option counts stay stable so the dancer can see what each toggle would surface.
- On mobile, From / Project / Tag / Type collapse behind a "Filters" disclosure with an active-filter count badge so the user reaches "Up next" sooner. "On your plate" and the status breakdown stay visible above the disclosure.
- **Drill view** strips the page down to a tag-grouped read-only checklist (Timing → Spacing → … → Other), with a "Recurring drills" header at the top surfacing any clusters. For dancers in two or more active projects, the view auto-narrows to the busiest project and shows a "Showing N notes from {project} — see all projects" header so they always know what show they're drilling. Each row carries the project name as a small chip when there's ambiguity. **Voice notes appear inline as their transcript text** when transcription has succeeded — you can read what to drill on without playing audio, which is the load-bearing piece for printing or studying away from the device. A **Print** button calls the browser's print dialog; a CSS print stylesheet hides chrome and reformats the page for paper / "Save as PDF".
- Voice notes (in Inbox view) play inline with the same coral-tinted player used elsewhere (audio only on this page; no video sync). The transcript disclosure appears under the player so dancers can skim before listening.

### Notes by me (author follow-through dashboard)
- Anyone who authors notes (Admin / Instructor / Assistant) sees a follow-through dashboard at `/notes-by-me`.
- A **summary strip** at the top reports follow-through % across all recipients (with a stacked progress bar broken down by status), the count of **stalled** notes, the count of **unassigned** notes (group / cast notes that haven't pinned a specific dancer yet), and a **Repeating** tile showing how many dancers are caught in a repeating cluster (only visible when at least one cluster exists).
- A note is **stalled** when it was authored more than 3 days ago and at least one recipient is still Open or In progress. Stalled notes get a tinted card border, a "Stalled" chip in the header, and the OPEN recipient pips on those notes pick up the same tint to flag who is holding things up. Click "Triage now" in the summary strip to filter to just stalled notes.
- A **filter + sort bar** offers `Outstanding / Stalled / Complete / Unassigned / All` with per-pill counts, plus a tag-filter row that appears whenever any tagged notes exist, plus a sort segmented control (`Stalled first / Most recent / Oldest`). Default view is Outstanding sorted Stalled-first.
- Each card carries the note's tag chip in the meta row when present. The card centers on the recipient list. A progress block shows `n/N addressed` + a stacked progress bar + a "Complete" badge when everyone has addressed or resolved the note. Below the bar is a row of recipient pips: avatar + name + status dot + status word for each assignee, plus a small "repeating" icon decoration on pips whose assignment is part of a cluster.
- Authors edit body / start / end timestamps, the tag, and audience, or delete any of their own notes via an overflow menu on each card. Audience changes diff-preserve dancers' existing statuses; voice-note edits cover timestamps, tag, and audience only (replacing audio means deleting the note and recording a new one).
- A shared section tab nav at the top of `/my-notes` and `/notes-by-me` makes it easy to flip between the recipient and author views.

## Roles and permissions

| Action | Admin | Instructor | Assistant | Dancer |
|---|:---:|:---:|:---:|:---:|
| Invite / resend / revoke team invitations | ✓ | | | |
| Create / archive projects | ✓ | ✓ | | |
| Manage project groups | ✓ | ✓ | | |
| Create rehearsals | ✓ | ✓ | ✓ | |
| Upload rehearsal video | ✓ | ✓ | ✓ | |
| Author text or voice notes | ✓ | ✓ | ✓ | |
| Edit or delete own notes | ✓ | ✓ | ✓ | |
| Address assigned notes | ✓ | ✓ | ✓ | ✓ |
| See project-page drill board + repeating clusters | ✓ | ✓ | ✓ | |
| See own personal drill list (/my-notes) | ✓ | ✓ | ✓ | ✓ |

## Running locally

```bash
npm install
npm run dev
```

Environment variables required (see `.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `DIRECT_URL` — direct (non-pooled) connection for Prisma migrations
- Clerk publishable key, secret key, and webhook secret
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` — point Clerk at the custom auth routes
- Google Cloud Storage credentials and bucket name
- `RESEND_API_KEY` — Resend API key for sending team invitation emails
- `NEXT_PUBLIC_APP_URL` — absolute origin used to build the accept link in invitation emails (e.g. `http://localhost:3000` locally, the deployed URL in production)
- `EMAIL_FROM` *(optional)* — sender address, e.g. `Eight Count <invites@yourdomain.com>`. Falls back to `Eight Count <onboarding@resend.dev>` which Resend only delivers to your own account email — verify a domain in Resend before inviting non-self addresses.
- `DEEPGRAM_API_KEY` — Deepgram API key, used to transcribe voice notes in the background. Sign up at [deepgram.com](https://deepgram.com) and generate a key. Without it, voice notes still record and play normally, but every transcript row marks `FAILED`. Optional `DEEPGRAM_MODEL` env override (defaults to `nova-3` in code).

Apply migrations:

```bash
npx prisma migrate dev
```

## Shipping to production

When deploying for real users:

1. **A verified sending domain in Resend**. Add the domain in the Resend dashboard, paste the SPF + DKIM (and ideally DMARC) DNS records into your registrar, and wait for verification.
2. **Set `EMAIL_FROM`** in your production environment to a verified address on that domain (e.g. `Eight Count <invites@yourdomain.com>`).
3. **Set `NEXT_PUBLIC_APP_URL`** to the deployed origin (no trailing slash) — the value is baked into the magic-link URL in every invitation email.
4. **Set `DEEPGRAM_API_KEY`** in your production environment (and Preview environment if you want transcription to run in preview deployments). Without it, voice notes upload and play correctly but every transcript row terminates as `FAILED` and the route logs a loud `[transcription] DEEPGRAM_API_KEY is not set` error.
5. **Run migrations on production** with `npx prisma migrate deploy` (not `migrate dev`).
6. **Backfill onboarding state for existing users**: open `scripts/backfill-onboarding-state.ts`, clear or trim the `SKIP_EMAILS` array (only used for local QA), then run `npm run db:backfill-onboarding` against the production database. This marks every user with prior activity as already onboarded so the tour only shows for genuine new signups. Idempotent — safe to re-run.
7. **Backfill transcripts for pre-transcription voice notes**: open `scripts/backfill-audio-transcripts.ts`, leave `DRY_RUN=true` for the first run (lists what would be processed), then flip to `DRY_RUN=false` and run `npm run db:backfill-transcripts`. The script processes one row at a time with a 250ms polite delay so it doesn't burst Deepgram, and `MAX_PROCESS=100` caps the first run to bound cost. Idempotent — re-run to drain anything missed. Roughly $0.01 per voice note, so a thousand-note backfill is under $10.

Send yourself a real invite to a fresh inbox to verify deliverability before opening invitations to teammates. Record a voice note end-to-end and confirm the transcript appears under the player within ~15s before declaring transcription production-ready.

### Removing a user (soft-delete)

There's no admin UI for user removal yet — until that ships, the operational pattern is direct SQL against the production DB:

```sql
UPDATE "User" SET "deletedAt" = NOW() WHERE id = '<user_id>';
```

The user disappears from team rosters, audience pickers, and group memberships immediately. Their authored notes and existing assignments stay attributed to them (the row still exists). If they later sign up with the same email, the app reclaims the row automatically — see "Account lifecycle" above.

For genuinely removing a user *and* their content (the rare "scrub everything" case), see the cascade-delete SQL recipe in CLAUDE.md under "User soft-delete + reclaim" — but soft-delete is the default operation, and reclaim is what most "I want to undo this" cases collapse into.

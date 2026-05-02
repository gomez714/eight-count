# Eight Count — Dance Rehearsal Feedback

A web application for choreographers to leave time-stamped text and voice feedback on rehearsal videos and track each dancer's progress through their notes.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | PostgreSQL via Prisma 7 |
| Auth | Clerk |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) |
| Forms | react-hook-form + Zod |
| Video / audio storage | Google Cloud Storage (signed URLs) |
| Recording | MediaRecorder API (mic-only) |
| Toasts | Sonner |

## Features

### Teams
- Create a team and invite members by email.
- Assign each member a role: **Admin**, **Instructor**, **Assistant**, or **Dancer**.
- Only Admins can add new members.

### Team page
The team page is the organizational home — it answers "who is on this team and what projects exist?" It sits above the project page in the hierarchy and is intentionally lighter and more administrative than the operational pages below it.

- **Header band** with breadcrumb (Dashboard › team), team mark, title, the viewer's role chip, and a compact meta strip showing **Members**, **Projects**, **Created**, the per-role glance (`3 admins · 2 instructors …`), and "Your role" at the end. The header carries no CTAs — primary actions live in the section headers below where they naturally belong, eliminating duplicates and quieting the top of the page.
- **Role popovers**: every role chip on the page (header, member rows) is a popover trigger. Tap any chip to see what that role can do. This replaced a persistent role glossary card and surfaces the explanation contextually instead of permanently.
- **Projects section** — the main column. Each project renders as an entry-point row (not a mini-dashboard): title, status pill, description, rehearsal count, an optional "open notes" accent (in-progress tint when there's pending work), and a relative last-activity timestamp. The list defaults to active projects; if any archived projects exist, a single inline toggle reveals or hides them (`Show archived (N)` ↔ `Hide archived`). Admins and Instructors get a `New project` button in the section header and a generous empty-state panel with a `Create first project` CTA when the team has no projects yet.
- **Members section** — sorted by role then name in a divided card list. Each row has the avatar, name + email, a "You" pill on the viewer's own row, and the member's role chip. **Admins** see a `…` overflow menu on other members' rows (currently `Copy email`; future role/remove actions slot here without redesigning the row). The toolbar is lazy: **search** appears at ≥8 members, the **role filter** appears at ≥6 members *and* ≥3 distinct roles. Below those thresholds the section is just a clean sorted list, with a chromeless "Invite by email" footer for admins.
- **Mobile responsive**: a segmented **Projects / Members** tab switcher lets the user focus on one section at a time. The header collapses (smaller mark, role chip moved below the title to avoid orphaning, counts compressed into a single `X members · Y projects` subtitle). Page is single-column on all sizes.

### Projects (pieces / dances)
- Create projects inside a team to represent individual dances or pieces.
- Attach a description and track active vs. archived status.
- Define **project groups** (Front line, Soloists, Captains, etc.) — named subsets of the team's cast that can be targeted when leaving notes. Groups are project-scoped so cast can differ between pieces.
- Only Admins and Instructors can create, edit, or delete groups and their membership.

### Project page
The project page is the structural bridge between a team and the rehearsal workspace — it answers "what project am I in, what's its state, and what should I do next?"

- **Header band** with breadcrumb (Dashboard › team › project), title, status pill, role pill, an optional description, and primary actions: **Manage cast** and **New rehearsal**. A meta strip below the title summarizes the project at a glance: rehearsal count, cast size, open-note count (tinted to flag work in progress vs. "all clear"), and a contributor avatar stack on desktop.
- **Rehearsals spine** is the main column — a list of rehearsal rows sorted newest-first. Each row shows a date plate, the rehearsal title, a "Current" pill on the most recent session in projects with two or more rehearsals, video duration, total note count with a coral voice-note tally, a small contributor stack, a relative-date label, and a "Stalled" chip when at least one assigned note is older than 3 days with active recipients. A right-side progress block shows `closed / total · %` with the same four-segment stacked bar used elsewhere, plus an "All notes resolved" badge when complete.
- **Groups rail** on the right (desktop) lists the project's groups in a compact card. Admins and Instructors can create new groups inline, edit member lists, and delete groups. Empty groups get a tinted "empty" pill and an inline "Add members" CTA. Groups are the audience pool the rehearsal composer pulls from when leaving section notes.
- **Empty state**: a fresh project with no rehearsals shows a generous panel with a "Create first rehearsal" CTA pre-wired into the same dialog that the header's New rehearsal button opens.
- **Responsive layout**: on desktop the rehearsals spine and groups rail sit side-by-side. On mobile, the page condenses (smaller title, single-line meta strip, icon-only secondary action) and a segmented **Rehearsals / Groups** tab switcher lets the user focus on one at a time. Rehearsals is the default mobile tab.

### Rehearsals
- Create dated rehearsal sessions within a project.
- Upload a single rehearsal video per session (Google Cloud Storage). Only Admins, Instructors, and Assistants can upload or replace the video.
- Sessions without a video show a calm empty state: staff see an upload form embedded in it; dancers see a passive "your instructor will upload one for this session" message.
- Once a video exists, the upload form is hidden. Staff replace the video via a `…` overflow menu in the rehearsal context bar (top of the page) — selecting **Replace video** opens a dialog with the upload form. Replacing keeps existing notes and their timestamps, but dancers won't see the form themselves.

### Rehearsal workspace
The rehearsal page is a sticky two-column workspace anchored at the top by a context bar (team / project / rehearsal breadcrumb, title, role pill, and rehearsal meta).

- **Left rail (sticky):**
  - **Stage-plate video** — dark gradient frame around the rehearsal video with a custom transport (play / pause toggle, ±5s seek, mono time display) and on-frame overlays for the file watermark and current time.
  - **Timeline card** — a 48-bucket density strip showing where notes cluster, a scrubbable track with note markers (coral for voice, teal for text), a playhead, and time ticks. Click any marker to jump the playhead to that note.
- **Right column:**
  - **Progress spine** — aggregate per-recipient progress across all notes: an "X / Y addressed-or-resolved" headline, open and in-progress counts, and a four-segment stacked bar broken down by `OPEN / IN_PROGRESS / ADDRESSED / RESOLVED`.
  - **Filter pills** — single-select pills: `All / Open / In progress / Addressed / Resolved / Unassigned / Voice / @ me`, plus a separate dropdown to filter by an arbitrary assignee. Pills show a precomputed count when inactive; a "Showing X of Y" indicator reflects the result set.
  - **Note thread** — each note row has a fixed timestamp rail (clickable to jump the video), a coral or teal accent stripe distinguishing voice from text, the author + audience chips, the body (text or voice waveform), and a dashed-divider "Assigned" row of avatar + name + status-dot + status-label chips per recipient.
  - **Sticky composer** at the bottom — a sub-bar with the Text / Voice mode toggle, a "To" audience picker (popover with the existing combobox: full-cast quick-pick, groups, individuals, removable chips), and a locked-timestamp pill that re-captures the current playhead when clicked. Body morphs between a 2-row textarea + Post button (text mode) and the voice recorder (voice mode).
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
- To replace the audio of an existing voice note, delete it and record a new one — voice-note edits cover timestamps and audience only.
- Recording requires Chrome, Firefox, or recent Safari (MediaRecorder support). The mic format is auto-detected: webm/opus on Chrome/Firefox, mp4/AAC on Safari.

### My notes (recipient inbox)
- Every dancer has a personal work queue at `/my-notes` listing every note assigned to them across all rehearsals and teams.
- Layout: a **left rail** with an "On your plate" count, a status breakdown, and From / Project / Type filters; a **queue** with an "Up next" hero card on top followed by collapsible status groups (Open, In progress, Addressed, Resolved).
- "**Up next**" surfaces the **oldest unresolved** note (Open or In progress) so the dancer always knows what's been waiting longest. If a filter is applied, the hero updates to honor it.
- Each card has an inline **status segmented control** (Open / In progress / Addressed / Resolved) — one click changes status, no dropdown — plus an "Open in rehearsal" link, the author's avatar, audience context chips ("Full cast", group, or "You"), and an "Edited" indicator if the note has been modified since creation.
- The left-rail filters narrow the queue: pick one author, one project, or text vs. voice (each is a single-select toggle; clicking again clears it). The "On your plate" count updates with the filter; the filter-option counts stay stable so the dancer can see what each toggle would surface.
- On mobile, From / Project / Type collapse behind a "Filters" disclosure with an active-filter count badge so the user reaches "Up next" sooner. "On your plate" and the status breakdown stay visible above the disclosure.
- Voice notes play inline with the same coral-tinted player used elsewhere (audio only on this page; no video sync).

### Notes by me (author follow-through dashboard)
- Anyone who authors notes (Admin / Instructor / Assistant) sees a follow-through dashboard at `/notes-by-me`.
- A **summary strip** at the top reports follow-through % across all recipients (with a stacked progress bar broken down by status), the count of **stalled** notes, and the count of **unassigned** notes (group / cast notes that haven't pinned a specific dancer yet).
- A note is **stalled** when it was authored more than 3 days ago and at least one recipient is still Open or In progress. Stalled notes get a tinted card border, a "Stalled" chip in the header, and the OPEN recipient pips on those notes pick up the same tint to flag who is holding things up. Click "Triage now" in the summary strip to filter to just stalled notes.
- A **filter + sort bar** offers `Outstanding / Stalled / Complete / Unassigned / All` with per-pill counts, plus a sort segmented control (`Stalled first / Most recent / Oldest`). Default view is Outstanding sorted Stalled-first.
- Each card centers on the recipient list. A progress block shows `n/N addressed` + a stacked progress bar + a "Complete" badge when everyone has addressed or resolved the note. Below the bar is a row of recipient pips: avatar + name + status dot + status word for each assignee.
- Authors edit body / start / end timestamps and audience, or delete any of their own notes via an overflow menu on each card. Audience changes diff-preserve dancers' existing statuses; voice-note edits cover timestamps and audience only (replacing audio means deleting the note and recording a new one).
- A shared section tab nav at the top of `/my-notes` and `/notes-by-me` makes it easy to flip between the recipient and author views.

## Roles and permissions

| Action | Admin | Instructor | Assistant | Dancer |
|---|:---:|:---:|:---:|:---:|
| Add team members | ✓ | | | |
| Create / archive projects | ✓ | ✓ | | |
| Manage project groups | ✓ | ✓ | | |
| Create rehearsals | ✓ | ✓ | ✓ | |
| Upload rehearsal video | ✓ | ✓ | ✓ | |
| Author text or voice notes | ✓ | ✓ | ✓ | |
| Edit or delete own notes | ✓ | ✓ | ✓ | |
| Address assigned notes | ✓ | ✓ | ✓ | ✓ |

## Running locally

```bash
npm install
npm run dev
```

Environment variables required (see `.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `DIRECT_URL` — direct (non-pooled) connection for Prisma migrations
- Clerk publishable key, secret key, and webhook secret
- Google Cloud Storage credentials and bucket name

Apply migrations:

```bash
npx prisma migrate dev
```

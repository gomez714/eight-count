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

### Projects (pieces / dances)
- Create projects inside a team to represent individual dances or pieces.
- Attach a description and track active vs. archived status.
- Define **project groups** (Front line, Soloists, Captains, etc.) — named subsets of the team's cast that can be targeted when leaving notes. Groups are project-scoped so cast can differ between pieces.
- Only Admins and Instructors can create, edit, or delete groups and their membership.

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

### My notes (dancer inbox)
- Every dancer has a personal inbox at `/my-notes` listing all notes assigned to them, across every rehearsal and team.
- Notes are grouped by status bucket: **Open**, **In Progress**, **Addressed**, **Resolved**.
- Each dancer independently updates the status of their own assignments.
- Audience context chips (e.g. "Full cast") appear on each note so the dancer knows whether it was a section or individual note.
- An "Edited" indicator appears on notes that have been modified after creation.
- Voice notes play inline with an audio control (audio only on this page).

### Notes by me (author dashboard)
- Instructors and choreographers can view all notes they have authored at `/notes-by-me`.
- Each note shows a progress counter (e.g. "12/20 addressed") across all recipients.
- Filter by Outstanding, Complete, or Unassigned to focus on what still needs attention.
- Edit or delete any note (text or voice) from this view; voice-note edits cover timestamps and audience only.

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

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
- Upload a single rehearsal video per session (Google Cloud Storage).

### Rehearsal workspace
- Stream the rehearsal video directly in the browser.
- Scrub the timeline to any point and capture the current timestamp (pauses the video automatically).
- Add notes in two modes via a Text / Voice tab toggle:
  - **Text notes** — type a written correction tied to the captured timestamp.
  - **Voice notes** — record short mic-only audio anchored to a video moment (see below).
- **Audience targeting** for each note (shared between text and voice modes):
  - **Full cast** — one click notifies every team member.
  - **Group** — select one or more project groups (e.g. "Front line") to target just that section; union semantics allow mixing groups and individuals.
  - **Individual members** — pick any combination of team members.
  - Leave the audience empty for an unassigned general note.
- A live "Will notify N people" count updates as you build the selection.
- A searchable combobox surfaces groups first, then individuals, with type-ahead filtering and removable selection chips.
- Only Admins, Instructors, and Assistants can author notes. Dancers see the video and their own notes but cannot create new ones.
- Notes are displayed in a timestamped list with status chips per recipient and audience chips (Full cast / group name) showing original targeting intent. Voice notes show a mic icon, a duration badge, and a player.
- Filter notes by status (All / Unresolved / Resolved / Unassigned) and by individual assignee.
- Authors can edit body/start/end timestamps and audience, or delete their own notes; audience changes diff-preserve dancers' existing statuses, and dancers see an "Edited" indicator on `/my-notes`.

### Voice notes
- Click **Voice** in the Add note card, then **Start recording**. The video pauses, a 3-second countdown runs (cancelable), then the video resumes muted while the mic captures up to 2 minutes of audio.
- The recording's `startTimestampMs` is the video position when the countdown ends; `endTimestampMs` is captured when the author clicks Stop (or the 2-minute cap auto-stops). The video is paused at the end position so the author can see where the take wraps up.
- The preview audio plays **in sync with the video**: the video rewinds to the recording's start and plays alongside the audio so the author can confirm alignment before saving. **Re-record** discards the blob without uploading; **Save** uploads the audio to Google Cloud Storage via signed URL and creates the note.
- In the rehearsal workspace, playing a saved voice note also runs in sync mode (video seeks to the recording start, mutes, and plays alongside the audio). On `/my-notes` and `/notes-by-me` the audio plays standalone.
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

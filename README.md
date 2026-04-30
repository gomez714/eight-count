# Eight Count — Dance Rehearsal Feedback

A web application for choreographers to leave time-stamped feedback on rehearsal videos and track each dancer's progress through their notes.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | PostgreSQL via Prisma 7 |
| Auth | Clerk |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) |
| Forms | react-hook-form + Zod |
| Video storage | Google Cloud Storage |
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
- Add time-stamped notes tied to that exact moment in the video.
- **Audience targeting** for each note:
  - **Full cast** — one click notifies every team member.
  - **Group** — select one or more project groups (e.g. "Front line") to target just that section; union semantics allow mixing groups and individuals.
  - **Individual members** — pick any combination of team members.
  - Leave the audience empty for an unassigned general note.
- A live "Will notify N people" count updates as you build the selection.
- A searchable combobox surfaces groups first, then individuals, with type-ahead filtering and removable selection chips.
- Only Admins, Instructors, and Assistants can author notes. Dancers see the video and their own notes but cannot create new ones.
- Notes are displayed in a timestamped list with status chips per recipient and audience chips (Full cast / group name) showing original targeting intent.
- Filter notes by status (All / Unresolved / Resolved / Unassigned) and by individual assignee.

### My notes (dancer inbox)
- Every dancer has a personal inbox at `/my-notes` listing all notes assigned to them, across every rehearsal and team.
- Notes are grouped by status bucket: **Open**, **In Progress**, **Addressed**, **Resolved**.
- Each dancer independently updates the status of their own assignments.
- Audience context chips (e.g. "Full cast") appear on each note so the dancer knows whether it was a section or individual note.

### Notes by me (author dashboard)
- Instructors and choreographers can view all notes they have authored at `/notes-by-me`.
- Each note shows a progress counter (e.g. "12/20 addressed") across all recipients.
- Filter by Outstanding, Complete, or Unassigned to focus on what still needs attention.

## Roles and permissions

| Action | Admin | Instructor | Assistant | Dancer |
|---|:---:|:---:|:---:|:---:|
| Add team members | ✓ | | | |
| Create / archive projects | ✓ | ✓ | | |
| Manage project groups | ✓ | ✓ | | |
| Create rehearsals | ✓ | ✓ | ✓ | |
| Upload rehearsal video | ✓ | ✓ | ✓ | |
| Author notes | ✓ | ✓ | ✓ | |
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

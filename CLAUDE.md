# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run typecheck    # Type-check without emitting
npm run lint         # ESLint
npm run format       # Prettier (all .ts/.tsx)
npm run build        # Production build

npx prisma migrate dev    # Create and apply a migration
npx prisma generate       # Regenerate Prisma client after schema changes
npx prisma studio         # Open database GUI
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — Pooled PostgreSQL connection string
- `DIRECT_URL` — Direct (non-pooled) connection for Prisma migrations
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- GCS: `GCS_BUCKET_NAME`, `GOOGLE_CLOUD_PROJECT_ID`, plus service account credentials

## Tech Stack

- **Framework**: Next.js 16 App Router
- **Database**: PostgreSQL via Prisma 7 with `PrismaPg` driver adapter (`@prisma/adapter-pg`)
- **Auth**: Clerk — synced to a local `User` table on every mutation
- **Storage**: Google Cloud Storage for rehearsal videos (signed URLs)
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix primitives in `components/ui/` — do not modify)
- **Forms**: react-hook-form + Zod; toasts via `sonner`

## Data Model

```
Team → Project → Rehearsal → VideoAsset
  ↓       ↓             ↓
TeamMember  ProjectGroup  AudioAsset[]   (one per voice note)
                          ↓
                          Note → NoteTarget[]
                            ↓
                          NoteAssignment → NoteAssignmentStatus
```

- **Teams** have members with roles: `ADMIN | INSTRUCTOR | ASSISTANT | DANCER`
- **Projects** belong to a team and can have **ProjectGroups** (e.g., "Front line")
- **Rehearsals** belong to a project and have one optional `VideoAsset`, many `AudioAsset`s (one per voice note), and many `Note`s
- **Notes** are either `TEXT` or `VOICE` (`Note.noteType`). They share targeting/assignment/status pipelines (see below)

### Note Types

Discriminated by `Note.noteType` (`TEXT` | `VOICE`):

- **TEXT**: `bodyText` required, `startTimestampMs` set, `endTimestampMs` and `audioAssetId` null.
- **VOICE**: `bodyText` null, `startTimestampMs` and `endTimestampMs` set (the recording's start/end against video time), `audioAssetId` references a 1:1 `AudioAsset` row. The author cannot change `noteType` after creation; replacing audio = delete + create new.

`bodyText` is nullable in the schema; the `noteType` discriminator decides which fields are required.

### Note Targeting System

Notes separate *audience intent* from *individual tracking*:

1. **`NoteTarget`** — the original audience (e.g., `EVERYONE`, a `GROUP`, or a specific `USER`)
2. **`NoteAssignment`** — one row per resolved recipient, each with independent status

Resolution: `EVERYONE` → all team members; `GROUP` → all group members; `USER` → that user. Multiple targets deduplicate by userId. Resolution logic lives in [lib/notes/resolve-targets.ts](lib/notes/resolve-targets.ts). See [app/api/rehearsals/[rehearsalId]/notes/route.ts](app/api/rehearsals/[rehearsalId]/notes/route.ts) for creation.

**Edit diffing**: When a note's audience is updated via `PATCH /api/notes/[noteId]`, the server diffs old vs. new resolved assignments. New recipients get a fresh `NoteAssignment`; removed recipients' assignments are deleted; existing recipients' assignments (and their statuses) are preserved untouched.

**Status storage**: `NoteAssignment` has no status field. Status lives in a separate optional `NoteAssignmentStatus` model (1:1 via `noteAssignmentId`). Absence of a row implies `OPEN`. Always update via upsert. Use `isActiveStatus(status)` from [lib/notes/statuses.ts](lib/notes/statuses.ts) to check if a status is `OPEN` or `IN_PROGRESS`.

**"Edited" indicator**: Notes track `updatedAt`. When `updatedAt > createdAt`, the note is shown with an "Edited" badge on `/my-notes`.

## Authentication

Two helpers — pick based on whether you need to write:

- **`ensureDbUser()`** ([lib/auth/ensure-db-user.ts](lib/auth/ensure-db-user.ts)) — use in server actions and API routes. Upserts the local `User` row from Clerk on every call (keeps name/email/image current).
- **`getCurrentDbUser()`** ([lib/auth/get-current-db-user.ts](lib/auth/get-current-db-user.ts)) — use in read-only server components. Looks up the existing row without syncing.

Both return `null` when unauthenticated. Standard guard:
```typescript
const dbUser = await ensureDbUser();
if (!dbUser) return { error: "You must be signed in." };
```

## Authorization

Use `get*ForUser()` functions that verify access through the ownership chain:
- `getTeamForUser(teamId, userId)` — checks `TeamMember` exists
- `getProjectForUser(projectId, userId)` — checks via team membership
- `getRehearsalForUser(rehearsalId, userId)` — checks via project → team

All return `null` if unauthorized. Never skip these and query directly.

## Role-Based Permissions

| Action | ADMIN | INSTRUCTOR | ASSISTANT | DANCER |
|---|:---:|:---:|:---:|:---:|
| Add team members | ✓ | | | |
| Create/archive projects | ✓ | ✓ | | |
| Manage project groups | ✓ | ✓ | | |
| Create rehearsals / upload video / author notes (text or voice) | ✓ | ✓ | ✓ | |
| Edit or delete own notes | ✓ | ✓ | ✓ | |
| Update their own note status | ✓ | ✓ | ✓ | ✓ |

Enforce via `TeamMember.role` after fetching with a `get*ForUser()` function.

## Server Actions

Action files live alongside their route pages:

| File | Exports |
|------|---------|
| `app/dashboard/actions.ts` | `createTeam()` |
| `app/teams/[teamId]/actions.ts` | `createProject()` |
| `app/teams/[teamId]/member-actions.ts` | `addTeamMember()` |
| `app/projects/[projectId]/actions.ts` | `createRehearsal()` |
| `app/projects/[projectId]/group-actions.ts` | `createProjectGroup()`, `updateProjectGroupMembers()`, `deleteProjectGroup()` |
| `app/my-notes/note-status-actions.ts` | `updateNoteAssignmentStatus()` |

All follow this pattern:

```typescript
"use server";
export async function createThing(
  _prevState: State,
  formData: FormData
): Promise<State>
```

- Validate with Zod; return `{ error?: string; success?: boolean }`
- Call `revalidatePath()` on any mutation

## API Routes

REST endpoints under `app/api/`:
- `POST /api/rehearsals/[rehearsalId]/notes` — create text or voice note (discriminated by `noteType`) with targets + assignments
- `PATCH /api/notes/[noteId]` — edit note (author-only; type-aware: text edits body+timestamp+targets, voice edits start/end+targets only). Diffs assignments to preserve existing statuses
- `DELETE /api/notes/[noteId]` — delete note and all its targets/assignments; also deletes the linked `AudioAsset` row for voice notes (author-only)
- `GET /api/rehearsals/[rehearsalId]/audience` — list all audience members and project groups for the target picker UI
- `POST /api/rehearsals/[rehearsalId]/video/upload-url` — generate GCS signed upload URL for video (staff roles only; mp4 / mov / webm)
- `POST /api/video-assets/[videoAssetId]/complete` — mark video upload complete
- `GET /api/rehearsals/[rehearsalId]/video/playback-url` — get signed video playback URL (1-hr expiry)
- `POST /api/rehearsals/[rehearsalId]/audio/upload-url` — generate GCS signed upload URL for a voice-note audio asset (staff roles only; 25 MB cap; webm/mp4/ogg/mpeg)
- `POST /api/audio-assets/[audioAssetId]/complete` — mark audio upload complete and store `durationMs`
- `GET /api/audio-assets/[audioAssetId]/playback-url` — get signed audio playback URL (1-hr expiry); fetched lazily on first play

Request/response types: [lib/api/contracts.ts](lib/api/contracts.ts) and [lib/api/responses.ts](lib/api/responses.ts). Create/update note request bodies are discriminated unions (`CreateTextNoteRequest | CreateVoiceNoteRequest`).

## Video Upload Flow

1. Client POSTs to `/upload-url` → server creates `VideoAsset` (`UPLOADING`) and returns GCS signed URL
2. Client uploads file directly to GCS
3. Client POSTs to `/complete` with duration → server sets status to `READY`

GCS path: `teams/{teamId}/projects/{projectId}/rehearsals/{rehearsalId}/video/{videoAssetId}-{filename}`

## Voice Note Recording Flow

Voice notes are mic-only recordings anchored to a moment in the rehearsal video. The blob is held in client memory and only uploaded on Save, so re-records don't create orphan `AudioAsset` rows.

UI flow (in [app/rehearsals/[rehearsalId]/workspace/voice-note-recorder.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-recorder.tsx)):

1. Author clicks **Start recording** → mic permission requested via `getUserMedia({ echoCancellation, noiseSuppression })`
2. Video pauses, `startTimestampMs` captured from `videoRef.current.currentTime`, video is muted
3. **3-second countdown** runs (with Cancel option)
4. Countdown ends: video resumes (still muted), `MediaRecorder` starts
5. Author clicks **Stop** (or 2-min auto-cap fires) → `endTimestampMs` captured, video pauses at end position, recording transitions to preview
6. Preview audio is wired to play in **sync with the video**: clicking play seeks the video to `startTimestampMs`, mutes it, and plays both together so the author can confirm alignment before saving
7. Author clicks **Save** → 4-step upload sequence runs:
   1. `POST /audio/upload-url` → creates `AudioAsset(UPLOADING)`, returns signed PUT URL
   2. `PUT` blob to GCS
   3. `POST /audio-assets/[id]/complete` → marks `READY`, stores `durationMs`
   4. `POST /rehearsals/[id]/notes` with `noteType=VOICE`, `audioAssetId`, `startTimestampMs`, `endTimestampMs`, `targets`

GCS path: `teams/{teamId}/projects/{projectId}/rehearsals/{rehearsalId}/audio/{audioAssetId}-{filename}`

Mime detection: prefers `audio/webm;codecs=opus`, falls back through `audio/webm`, `audio/mp4;codecs=mp4a.40.2`, `audio/mp4`, `audio/ogg;codecs=opus`. Recording is hard-capped at 2 minutes. On save failure, the blob is retained so the user can retry without re-recording.

## Voice Note Playback (Sync Mode)

[app/rehearsals/[rehearsalId]/workspace/voice-note-player.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-player.tsx) runs in two modes:

- **Standalone** (used on `/my-notes`, `/notes-by-me`): just plays the audio. Lazy-fetches the signed playback URL on first play click.
- **Synced** (used in the rehearsal workspace, when both `videoRef` and `startTimestampMs` props are passed): clicking play seeks the rehearsal video to `startTimestampMs`, mutes it, and plays the audio + video together. Pausing/ending the audio pauses the video and restores its prior mute state. Manually pausing the video also pauses the audio.

The UI is a custom transport — coral-tinted pill with a circular play / pause button, a 32-bar decorative waveform that fills as playback progresses, and a mono duration label. The native `<audio>` element is still in the DOM (with `ref` + event handlers) but its `controls` are hidden; click-on-bars seeks. The recorder preview state in [voice-note-recorder.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-recorder.tsx) uses the same transport via a local `PreviewPlayer` component (it shows `current / total` time since the verify-before-save flow benefits from precise feedback). The waveform bars are *decorative only* — heights come from a static `Math.sin`-based formula, not real audio analysis.

## Rehearsal Workspace UI

The rehearsal page renders a context bar above the workspace and a sticky two-column workspace beneath it. All client state — playback URL, scrubbing, audience selection, edit-modal, voice flow — lives in [workspace/rehearsal-workspace.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-workspace.tsx). The other workspace components are presentational and receive props.

| File | Responsibility |
|---|---|
| [rehearsal-context-bar.tsx](app/rehearsals/[rehearsalId]/rehearsal-context-bar.tsx) | Page header: breadcrumb (team → project → rehearsal), title, role pill, meta row. Edge-to-edge background with `mx-auto max-w-7xl` content wrapper to align with the workspace below. Accepts an optional `actions` slot rendered on the right side of the title row — used for rehearsal-level actions like Replace video. |
| [rehearsal-actions-menu.tsx](app/rehearsals/[rehearsalId]/rehearsal-actions-menu.tsx) | Staff-only overflow `…` menu rendered into the context bar's `actions` slot when a video exists. Currently has a single **Replace video** item that opens a `<Dialog>` containing the upload form. Designed to extend with future rehearsal-level actions (delete, archive, share). |
| [workspace/rehearsal-workspace.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-workspace.tsx) | Orchestrator. Owns `videoRef`, `timelineRef`, scrubbing pointer state, playback-URL fetch, audience selection, edit-modal state. Layout: `lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]` with sticky-top left rail and sticky-bottom composer in the right column. |
| [workspace/rehearsal-video-card.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-video-card.tsx) | Dark "stage plate" wrapping `<video>` with no native `controls`, custom transport (play / pause + ±5s + mono time), and on-frame overlay pills (file watermark, time pill, center play button when paused). `isPlaying` is tracked locally via the audio element's `onPlay`/`onPause`/`onEnded` events. |
| [workspace/rehearsal-timeline-card.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-timeline-card.tsx) | Separate card with a 48-bucket density strip, scrubbable track, voice/text colored markers, playhead, and 5 evenly-spaced time ticks. Density bars are absolutely positioned (not flex) so they share the same `0–100%` coordinate system as the markers. |
| [workspace/notes-summary.tsx](app/rehearsals/[rehearsalId]/workspace/notes-summary.tsx) | "Progress spine" — aggregates `NoteAssignment` statuses across all notes (not per-note) into a four-segment stacked bar. Returns `null` when there are no assignments. |
| [workspace/notes-list-card.tsx](app/rehearsals/[rehearsalId]/workspace/notes-list-card.tsx) | Filter pill row (`ALL / OPEN / IN_PROGRESS / ADDRESSED / RESOLVED / UNASSIGNED / VOICE / MINE`) + assignee dropdown + thread of `NoteRow`s. Pills show precomputed counts; status filters match notes that have *any* assignment with the given status. |
| [workspace/add-note-card.tsx](app/rehearsals/[rehearsalId]/workspace/add-note-card.tsx) | Sticky composer. Sub-bar with mode tabs, audience popover (wraps the existing `AudiencePicker`), and a locked-timestamp pill that re-captures the current playhead on click (replaces the old standalone "Capture current timestamp" button). |
| [workspace/audience-picker.tsx](app/rehearsals/[rehearsalId]/workspace/audience-picker.tsx) | Combobox-style picker (full-cast quick action, groups, individuals). Now rendered inside the composer's audience popover and inside `EditNoteSheet`. |
| [workspace/status-chip.tsx](app/rehearsals/[rehearsalId]/workspace/status-chip.tsx) | Per-recipient status chip (`name + 7px dot + status label`). Exports `StatusDot` for reuse (used by `notes-summary.tsx`). |

### Design tokens

The status palette and voice-note accent are CSS variables in [app/globals.css](app/globals.css), defined in both `:root` and `.dark`:

- `--status-open-{bg,fg,border}`, `--status-progress-*`, `--status-addressed-*`, `--status-resolved-*` — derived from the existing teal primary so nothing reads as alarming.
- `--note-voice-{accent,bg,border}` — coral, used for voice-note accent stripes, waveform bars, and recorder/preview chrome.

Use `var(--*)` directly (or `color-mix(in oklch, var(--*) X%, transparent)` for translucent tints) rather than hard-coding colors. New status states should be added by extending these tokens, not by introducing per-component palettes.

## Page Structure

- `/` — Landing (unauthenticated)
- `/dashboard` — Team list + create team
- `/teams/[teamId]` — Team overview, member management
- `/projects/[projectId]` — Project details, rehearsal list, group management
- `/rehearsals/[rehearsalId]` — Rehearsal workspace. Page header is a `RehearsalContextBar` (breadcrumb / title / role / meta); body is a sticky two-column workspace with the stage-plate video + density timeline on the left and a thread (progress spine, pill filters, note list, sticky composer) on the right. Voice-note playback is video-synced here. See "Rehearsal Workspace UI" above.
- `/my-notes` — Dancer inbox: all notes assigned to current user, with status controls and "Edited" indicators. Voice notes play standalone (audio only)
- `/notes-by-me` — Author view: all notes the current user created, with per-note progress metrics and edit/delete actions. Voice notes play standalone (audio only)

## Key Conventions

**Imports**: `@/*` resolves to the repo root. Always use absolute imports (`@/lib/db`, `@/components/ui/button`). Prisma types: `import type { X } from "@/generated/prisma/client"`. Never instantiate `PrismaClient` directly — import `db` from [lib/db.ts](lib/db.ts).

**Types**: Co-locate in a `types.ts` within the feature directory. Map Prisma results to explicit UI types rather than leaking Prisma types into components.

**Components**: Server components fetch their own data (no prop drilling). Client components are marked `"use client"`. Shared components live in `components/`; feature-specific ones live next to their page.

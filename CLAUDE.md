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

npm run db:backfill-onboarding  # One-shot script: mark active users as already-onboarded.
                                # See "Onboarding tour" below.

npm run db:backfill-transcripts # One-shot script: run Deepgram transcription on
                                # voice notes recorded before transcripts shipped.
                                # See "Voice Note Transcription" below.

npm run db:reap-stale-uploads   # One-shot script: reconcile VideoAsset/AudioAsset
                                # rows stuck at status=UPLOADING for >24h against
                                # GCS. Recovers rows whose object actually landed;
                                # deletes rows pointing at nothing.
                                # See "Video Upload Flow" below.
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string. Used by both the running app (via `lib/db.ts`) and `prisma migrate`. The project does **not** declare `directUrl` in `schema.prisma`, so a single URL covers both runtime and migrations. For prod, prefer a non-pooled connection string if the provider offers one (Neon, Supabase) — pooled connections through PgBouncer can occasionally trip during DDL, though the migrations in this repo are small enough that the pooler URL works in practice too.
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Clerk routing: `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- GCS: `GCS_BUCKET_NAME`, `GOOGLE_CLOUD_PROJECT_ID`, plus service account credentials
- Email (team invitations): `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` (absolute URL the invite-acceptance link is built from — e.g. `http://localhost:3000` locally, the deployed origin in prod), and optional `EMAIL_FROM` (e.g. `Eight Count <invites@yourdomain.com>`). Falls back to `Eight Count <onboarding@resend.dev>` which Resend only delivers to your own account email — verify a domain in Resend before inviting non-self addresses.
- Transcription: `DEEPGRAM_API_KEY` (required for voice-note transcription) and optional `DEEPGRAM_MODEL` (defaults to `nova-3`). When unset, voice-note rows mark `transcriptStatus = FAILED` instead of crashing — production deployments should always set it; the route logs a loud `[transcription]` error if missing in `NODE_ENV=production`. See "Voice Note Transcription" below.
- Admin (in-app feedback inbox): `ADMIN_EMAILS` — comma-separated allowlist of email addresses that can access `/admin/*`. Case-insensitive match against `User.email`. Non-admins (or unset env) get redirected to `/dashboard` rather than a 403 — the surface is intentionally unlisted. Driven by env so adding/removing admins requires no migration. See "In-app feedback widget" below.

## Tech Stack

- **Framework**: Next.js 16 App Router
- **Database**: PostgreSQL via Prisma 7 with `PrismaPg` driver adapter (`@prisma/adapter-pg`)
- **Auth**: Clerk — synced to a local `User` table on every mutation. **Auth UI is fully headless** (custom `/sign-in` and `/sign-up` routes built on Clerk's `useSignIn` / `useSignUp` hooks). See "Auth UI" below.
- **Storage**: Google Cloud Storage for rehearsal videos (signed URLs)
- **Email**: Resend (`resend` npm package). Used for team invitation emails. See "Team Invitations" below.
- **UI**: Tailwind CSS 4 + shadcn/ui (Radix primitives in `components/ui/` — do not modify)
- **Theming**: `next-themes` with `attribute="class"`, `defaultTheme="system"`. Mounted in `app/layout.tsx`. CSS tokens in `globals.css` adapt via `:root` / `.dark` so every component flips automatically.
- **Forms**: react-hook-form + Zod; toasts via `sonner`

## Data Model

```
Team → Project → Rehearsal → VideoAsset
  ↓       ↓        ↓             ↓
TeamMember  ProjectGroup  AudioAsset[]   (one per voice note OR voice discussion)
  ↑           ↓           ↓
TeamInvitation  ↓        Note → NoteTarget[]
                ↓          ↓
                ↓        NoteAssignment → NoteAssignmentStatus
                ↓          ↓
                ↓        NoteComment[]      (threaded replies, soft-deleteable)
                ↓        NoteReaction[]     (👍 🙋 ❤️ — one per user per kind)
                ↓        NoteThreadView[]   (per-(note, user) last-viewed)
                ↓
                Discussion → DiscussionComment[]    (same shape as NoteComment)
                ↓             DiscussionReaction[]  (same shape as NoteReaction)
                ↓             DiscussionThreadView[]
                ↓
                ProjectResource (titled links — production docs, refs)
```

- **Teams** have members with roles: `ADMIN | INSTRUCTOR | ASSISTANT | DANCER`
- **TeamInvitations** sit alongside `TeamMember` and represent pending or historical email invites. Status: `PENDING | ACCEPTED | REVOKED | EXPIRED`. Accepting an invitation creates a `TeamMember` row; the invitation row stays as a record. See "Team Invitations" below.
- **Notes** carry an optional `tag: NoteTag?` (`TIMING | SPACING | ENERGY | MUSICALITY | FORMATION | TECHNIQUE`). Tags are global enum values, optional, and apply uniformly to TEXT and VOICE notes. See "Note Tags" and "Repeating-correction detection" below.
- **Projects** belong to a team and can have **ProjectGroups** (e.g., "Front line")
- **Rehearsals** belong to a project and have one optional `VideoAsset`, many `AudioAsset`s (one per voice note or voice discussion), and many `Note`s
- **AudioAssets** carry transcript state alongside upload state: `transcript`, `transcriptStatus: TranscriptStatus` (`PENDING | PROCESSING | READY | FAILED`), `transcriptError`, `transcribedAt`. See "Voice Note Transcription" below.
- **Notes** are either `TEXT` or `VOICE` (`Note.noteType`). They share targeting/assignment/status pipelines (see below)
- **Notes** carry a conversational layer — `NoteComment[]` (flat, text-only, soft-deleteable), `NoteReaction[]` (fixed set: `ACKNOWLEDGE | QUESTION | ENCOURAGE`, one per user per kind, click-again-to-remove), and `NoteThreadView[]` for unread tracking. See "Note threads (comments + reactions)" below.
- **Discussions** are the conversational counterpart to notes — broader creative/process questions ("what quality should we engage here?", "would this work better another way?") with **no assignment, no status, no follow-through**. Author + thread only. Live at the project level always; optionally anchored to a rehearsal, and optionally to a moment (or range) on that rehearsal's video. **Anyone in the team can author one** — including dancers (departure from `Note` which is staff-write-only). Reuse `NoteType` for `TEXT | VOICE`. Voice requires a rehearsal anchor (project-level voice is not supported in v1). Threads use the same shared component family (`<ThreadAttachment target={{ type: "discussion", id }} ... />`) and the same `<canViewThread>` / `<loadThread>` server helpers, parameterized over `ThreadTarget`. See "Discussions" below.
- **ProjectResources** are reference artifacts attached to a project — titled external links in v1 (running orders, choreography refs, shared spreadsheets), with `FILE` reserved for v1.5 via a separate `FileAsset` table. Project-scoped with a nullable `rehearsalId` reserved for the v1.5 anchoring UI. **Staff-write** (`ADMIN | INSTRUCTOR | ASSISTANT`) since they read as production documents (downward authority, like notes — not horizontal like discussions); author-only edit/delete. No threads, no status. See "Project Resources" below.

### Note Types

Discriminated by `Note.noteType` (`TEXT` | `VOICE`):

- **TEXT**: `bodyText` required, `startTimestampMs` set, `endTimestampMs` and `audioAssetId` null.
- **VOICE**: `bodyText` null, `startTimestampMs` and `endTimestampMs` set (the recording's start/end against video time), `audioAssetId` references a 1:1 `AudioAsset` row. The author cannot change `noteType` after creation; replacing audio = delete + create new.

`bodyText` is nullable in the schema; the `noteType` discriminator decides which fields are required.

### Note Tags

Notes carry an optional single `tag` from the `NoteTag` enum: `TIMING | SPACING | ENERGY | MUSICALITY | FORMATION | TECHNIQUE`. Tags are author-set, optional everywhere (no required-tag setting), and apply uniformly to TEXT and VOICE.

- Schema: `Note.tag NoteTag?` with `@@index([tag])` to support repeating-cluster queries.
- Vocabulary lives in [lib/notes/tags.ts](lib/notes/tags.ts) (mirrors Prisma enum literally so the module stays client-safe). Exports `NOTE_TAGS`, `NoteTag` type, `NOTE_TAG_LABELS`, `NOTE_TAG_DESCRIPTIONS`, and an `isNoteTag` runtime guard.
- Picker: [TagPicker](app/rehearsals/[rehearsalId]/workspace/tag-picker.tsx) — Radix Popover with chevron-pill trigger, single-select, "Clear tag" footer when set. Used in `AddNoteCard` (composer) and `EditNoteSheet`.
- Display: [components/tag-chip.tsx](components/tag-chip.tsx) is the single neutral chip primitive. No per-tag color palette in v1; tags use `--muted` / `--muted-foreground` tokens.
- API: `tag?: NoteTag | null` on `CreateTextNoteRequest`, `CreateVoiceNoteRequest`, `UpdateTextNoteRequest`, `UpdateVoiceNoteRequest` in [lib/api/contracts.ts](lib/api/contracts.ts). PATCH semantics — `undefined` leaves the column untouched, `null` clears it, valid enum value sets it.

### Note threads (comments + reactions)

Each note carries an optional conversational layer — flat text-only replies, a fixed set of reactions, and per-viewer unread tracking. The feature is the "more conversational collaboration" surface that complements the structured `NoteAssignment` status pipeline: status answers "where is this note in your work?", while comments + reactions answer "what's the back-and-forth about it?".

**Visibility**: any team member of the owning team can see and post on a thread. Threads are **public** within the team — a reply is visible to the author and every assignee. Reactions are limited to a fixed set so the vocabulary stays intentional.

**Vocabulary**:
- `ACKNOWLEDGE` (👍 — "Got it, I've seen this")
- `QUESTION` (🙋 — "I have a question about this note"; doubles as the "dancer questions" flag without inventing a separate concept)
- `ENCOURAGE` (❤️ — "Sending a little support")

#### Data model

| Model | Purpose |
|---|---|
| `NoteComment` | One row per reply. `bodyText` required, ≤ 2000 chars. `editedAt` set on edits; rendered as a small `· edited` text after the timestamp. `deletedAt` is a soft-delete tombstone — the row stays so thread continuity is preserved; the body renders as muted italic "Comment deleted" with the original author + time still visible. `@@index([noteId, createdAt])` so per-note fetches are fast. |
| `NoteReaction` | One row per (note, user, kind). `@@unique([noteId, userId, kind])` enforces "one of each kind per user per note". Toggle = create-or-delete. |
| `NoteThreadView` | One row per (note, user). `lastViewedAt` is a plain `DateTime @default(now())` that's explicitly set on every view bump (not `@updatedAt` — see migration `make_thread_view_last_viewed_explicit`). Powers the dashboard unread-comment count by comparing comment `createdAt` against this row's `lastViewedAt`. |

`Note → onDelete: Cascade` clears all three when a note is deleted; `User` rows are never hard-deleted (see "User soft-delete + reclaim") so author attribution on old comments survives the user being removed from the team.

#### Files

| File | Responsibility |
|---|---|
| [lib/threads/api-paths.ts](lib/threads/api-paths.ts) | **Client-safe.** Exports `ThreadTarget` (`{ type: "note" \| "discussion"; id: string }`) — the discriminator that parameterizes every thread surface — plus `threadApiPaths(target)` which returns `{ comments, commentById, reactions, view }` URL strings. Single source of truth for thread URL building so `<Thread />`, `<CommentComposer />`, `<CommentRow />`, and `<ReactionBar />` don't duplicate the `/api/notes/...` vs `/api/discussions/...` branching. |
| [lib/threads/reactions.ts](lib/threads/reactions.ts) | `REACTION_KINDS` const tuple, `ReactionKind` type, `REACTION_EMOJI`, `REACTION_LABELS`, `REACTION_DESCRIPTIONS`, `isReactionKind` runtime guard. Client-safe (no Prisma import) so it can be imported anywhere. |
| [lib/threads/comments.ts](lib/threads/comments.ts) | **Client-safe.** `COMMENT_MAX_LENGTH = 2000`. `ThreadComment` / `ThreadReactionSummary` / `ThreadPayload` / `ThreadSummary` types. `summarizeThread({ viewerId, comments, reactions, lastViewedAt })` — pure helper that turns raw rows into the `(commentCount, reactions, hasUnread)` chip seed. Used by `getRehearsalForUser`, `getAssignedNotesForUser`, and `getNotesByAuthor` so the initial paint is correct without a client round-trip. |
| [lib/threads/thread-access.ts](lib/threads/thread-access.ts) | **Server-only** (`import "server-only"` at the top). Parameterized over `ThreadTarget` (a `{ type: "note" \| "discussion"; id: string }` discriminator from [lib/threads/api-paths.ts](lib/threads/api-paths.ts)) so the same surface covers notes today and discussions next. `canViewThread(target, userId)` — team-membership gate used by every thread route, returns `{ target, teamId } \| null`. `loadThread(target, viewerId)` — serializes comments (with tombstones + per-author role pills) and aggregated reactions for the GET / PATCH / DELETE / POST endpoints. Discussion branches throw `THREAD_TARGET_NOT_IMPLEMENTED` until PR 2 lands the schema. Kept separate from `comments.ts` so client components can import constants/types without pulling Prisma into the browser bundle. |
| [lib/threads/get-unread-comment-count.ts](lib/threads/get-unread-comment-count.ts) | `getUnreadCommentCountForUser(userId)` — **combined** count of unread comments across note threads + discussion threads. Returns a single number for the dashboard chip + meta-band line. Two parallel batches under the hood: `countUnreadNoteComments` (engagement-scoped — notes the user authored or was assigned) and `countUnreadDiscussionComments` (membership-scoped — discussions on any team the user belongs to). Both exclude the user's own comments and soft-deleted ones; both count comments newer than the user's `*ThreadView.lastViewedAt`. Reasonable for v1; if either scan grows hot, promote to materialized `unreadCount` integers on the respective view tables. |

#### API routes

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/notes/[noteId]/comments` | `GET` | Team member of note's team | Returns serialized thread. |
| `/api/notes/[noteId]/comments` | `POST` | Same | Body: `{ bodyText }`. Trim → length check (1..2000). Bumps author's `NoteThreadView` so their own write doesn't count as unread to them. |
| `/api/notes/[noteId]/comments/[commentId]` | `PATCH` | **Author of the comment only** | Sets `editedAt = now()`. Returns the full thread. |
| `/api/notes/[noteId]/comments/[commentId]` | `DELETE` | **Author of the comment only** | Soft delete (`deletedAt`). Idempotent — re-deleting a tombstone returns the current state. |
| `/api/notes/[noteId]/reactions` | `POST` | Team member | Body: `{ kind }`. Toggles (creates if absent, deletes if present). Returns the updated reaction summary. |
| `/api/notes/[noteId]/thread/view` | `POST` | Team member | Upserts `NoteThreadView.lastViewedAt = now()`. Fire-and-forget from the client on thread expand. |

Visibility helper: `canViewThread(target, userId)` from [lib/threads/thread-access.ts](lib/threads/thread-access.ts) (returns `{ target, teamId } | null`) — used by every thread route, called as `canViewThread({ type: "note", id: noteId }, userId)` from the note routes. Walks the note → rehearsal → project → team → members chain.

#### UI components (all under `components/threads/`)

Renamed from `components/notes/` and parameterized over `ThreadTarget` so the same components serve note threads today and discussion threads next. Each component takes a `target: { type: "note" | "discussion"; id: string }` prop instead of a bare `noteId`; URLs are built via `threadApiPaths(target)` in [lib/threads/api-paths.ts](lib/threads/api-paths.ts).

| File | Responsibility |
|---|---|
| [components/threads/thread-summary-chip.tsx](components/threads/thread-summary-chip.tsx) | Collapsed footer pill. Renders `💬 N replies · 👍 a · 🙋 q · ❤️ e` with reaction counts shown only when > 0. Unread state surfaces as a small `--primary`-tinted dot at the top-right of the message icon. When the thread has zero activity, hides entirely unless `showStartHint` is true — in which case it renders a muted "Start a discussion" affordance. The chip is the expand toggle (`aria-expanded` tracks state). |
| [components/threads/thread.tsx](components/threads/thread.tsx) | `<Thread />` — expanded thread shell. On mount: fetches `GET ${threadApiPaths(target).comments}` and fire-and-forgets `POST ${threadApiPaths(target).view}`. Renders `<ReactionBar />`, the comment list (divided rows), and `<CommentComposer />`. Bubbles a stable `(commentCount, reactions, hasUnread: false)` summary up through `onSummaryChange` so the parent's chip stays in sync without a refetch. The state-signature compare prevents update loops if the parent passes the same data back as props. Accepts a controlled `commentDraft` + `onCommentDraftChange` so the attachment can preserve the in-progress text across unmounts. |
| [components/threads/reaction-bar.tsx](components/threads/reaction-bar.tsx) | 3-pill row, always ordered `👍 → 🙋 → ❤️` so positions are learnable. Each pill is a `button` with `aria-pressed` for the viewer's state. Optimistic toggle (UI flips immediately, server reconciles via the toggle endpoint). Disabled during in-flight requests; reverts + sonner-toasts on failure. |
| [components/threads/comment-row.tsx](components/threads/comment-row.tsx) | Avatar (`AvatarInitials` keyed by `comment.authorId`) + name + role pill (from the team's role map for the note's team — comment authors who left the team render with no pill) + relative timestamp + optional `· edited`. Body is `whitespace-pre-wrap break-words`. Author-only `DropdownMenu` with **Edit** and **Delete** (destructive variant). Edit opens an inline `<Textarea>` with Save / Cancel; Save sends `PATCH`, Cancel restores the original draft. Delete confirms via `window.confirm`. Soft-deleted rows render as a muted "Comment deleted" line with the author + timestamp preserved. |
| [components/threads/comment-composer.tsx](components/threads/comment-composer.tsx) | Always-visible at the bottom of an expanded thread. Single `<Textarea>` with `field-sizing-content`, char counter that only appears past 1800/2000 (so the resting UI stays quiet), `Cmd/Ctrl + Enter` to send, Send button disabled when empty. **Controlled draft** via `draft` + `onDraftChange` props (lifted to the attachment so the text survives auto-collapse on mobile). On successful POST, replaces local thread state and clears the draft. |
| [components/threads/thread-attachment.tsx](components/threads/thread-attachment.tsx) | `<ThreadAttachment />` — **single entry point** every surface uses. Consumes `ThreadExpansionProvider` for coordinated expand/collapse (falls back to local `useState` when no provider is mounted, so the attachment works standalone). Holds the comment-composer draft (`useState("")`) so the draft survives the inner `<Thread />` unmounting — either when the user collapses, or when mobile's single-thread rule auto-collapses this one to open another. Threads `onSummaryChange` from `<Thread />` back into local chip state. Once the user expands once, the unread dot stays cleared even if they collapse the thread again. Props: `target` (a `ThreadTarget` — `{ type: "note", id }` today), `viewerId`, `initialCommentCount`, `initialReactions`, `initialHasUnread`, `showStartHint`. |
| [components/threads/thread-expansion-context.tsx](components/threads/thread-expansion-context.tsx) | `ThreadExpansionProvider` + `useThreadExpansion()` hook. Tracks expanded threads as a `Set<string>` keyed by `${target.type}:${target.id}` so note IDs and discussion IDs (both cuids) never collide and the mobile single-open rule applies across the union. **Mobile (or `useMediaQuery` returning null during SSR)**: opening any thread first clears the set, so only one thread is open at a time — avoids vertical-stack chaos when multiple threads have replies. **Desktop (`≥ lg`)**: threads accumulate freely, supporting side-by-side comparison of replies across notes (Slack/GitHub-style power-user behavior). Mounted at each list-level surface (`RehearsalWorkspace`, `MyNotesList`, `NotesByMeList`) so each page coordinates its own threads independently. |
| [components/threads/unread-comments-indicator.tsx](components/threads/unread-comments-indicator.tsx) | Small `--primary`-tinted "N new" pill for the dashboard. Returns `null` when count ≤ 0. |

#### Where threads appear

| Surface | File | `showStartHint` | Notes |
|---|---|---|---|
| Workspace `NoteRow` | [notes-list-card.tsx](app/rehearsals/[rehearsalId]/workspace/notes-list-card.tsx) | author or assignee | One attachment per row. Initial state seeded server-side via `summarizeThread`. |
| `/my-notes` `AssignedNoteCard` | [assigned-note-card.tsx](app/my-notes/assigned-note-card.tsx) | always (recipient is by definition involved) | Renders below the action row. Hero card gets the same treatment. |
| `/notes-by-me` `AuthoredNoteCard` | [authored-note-card.tsx](app/notes-by-me/authored-note-card.tsx) | always (author is involved) | Renders below the per-recipient pip row. |

**Not added to**: drill view (`/my-notes?view=drill` and the project-page drill section) — drill mode is intentionally read-only / print-focused. The chip would clutter the dense checklist layout, and the printed sheet doesn't need conversational chrome.

#### Initial-paint pattern

Every "list of notes" query (`getRehearsalForUser`, `getAssignedNotesForUser`, `getNotesByAuthor`) now selects:
- `comments`: just `{ authorId, deletedAt, createdAt }` — enough to compute the chip count + unread flag without dragging the full body text into the list query.
- `reactions`: just `{ kind, userId }` — enough to compute the per-kind counts and the viewer's pressed state.
- `threadViews`: filtered by viewer's `userId`, selects `{ lastViewedAt }`.

The page entry then calls `summarizeThread` once per note. The full thread (with comment bodies) only loads when the user expands the attachment.

#### Dashboard unread surfacing

Two places on `/dashboard` get a count when `getUnreadCommentCountForUser(viewerId) > 0` — both surface the **combined** note + discussion thread count, not separate numbers (users think in "new replies waiting", not by entity type):
- `DashboardMetaBand` — fourth `MetaChip` "New replies" only renders when count > 0 (mirrors the conditional repeating-tile pattern on `/notes-by-me`).
- `WorkTiles` — a single `UnreadCommentsIndicator` line below the 2-up tile grid (`"💬 N new across your notes and discussions"`). Single line for both tiles together, since the count covers the union of "notes you authored / were assigned" + "discussions on teams you belong to" and a user often shows up in multiple buckets.

**Scope rules differ by entity** (intentional — see `lib/threads/get-unread-comment-count.ts`):
- **Note unreads**: engagement-scoped. Counted only when the viewer is the note's author or one of its assignees. Notes have a precise "who is involved" via the assignment chain.
- **Discussion unreads**: membership-scoped. Counted across any discussion on any team the viewer belongs to. Discussions don't have assignees, so the natural scope is "anywhere I can see" — matches the Slack/channel mental model.

No realtime push in v1 — the count refreshes on next dashboard navigation. The unread-indicator dot on individual thread chips clears the moment the user expands the thread (via the `POST /thread/view` write), so within a single page the local state stays truthful even though the dashboard count doesn't auto-refresh.

#### Permissions

| Action | Who |
|---|---|
| View thread | Any team member of the note's team |
| Post comment | Any team member of the note's team |
| Edit comment | Comment author only |
| Delete comment | Comment author only |
| Toggle reaction | Any team member |
| Bump `NoteThreadView` | Self (the viewer) |

No admin override on delete in v1 — escape hatch is a SQL update. Soft-delete preserves the row + timestamps so recovery is trivial.

#### Deferred (explicit non-goals for v1)

Voice replies, reactions on individual comments, nested replies / quote-replies, `@mentions`, realtime updates (polling or SSE), email / push notifications, in-app notification center / bell, admin override delete, rich text / link previews. Each of these is a deliberate scope cut — the v1 surface is small enough to ship behind a single migration and three new component files, and the data model accommodates the deferred features when they land.

### Discussions

The conversational counterpart to notes. Where a `Note` answers "here's a correction someone owes follow-through on," a `Discussion` answers "what is this section about?" / "what quality should we engage here?" / "is there a different way to approach this phrase?" — the open-ended creative conversations that don't fit the actionable note model.

**Defining contrast with notes:**
- **No assignment.** Discussions don't fan out to per-recipient rows. Visibility is team-wide; engagement is voluntary.
- **No status pipeline.** No OPEN/IN_PROGRESS/ADDRESSED/RESOLVED. A discussion is open-ended forever (or until the author deletes it).
- **No follow-through.** Stalled detection, repeating-cluster derivation, drill view — all skip discussions entirely. The dashboard "on your plate" count is unaffected.
- **Anyone authors.** All four roles (`ADMIN | INSTRUCTOR | ASSISTANT | DANCER`) can create, edit, and delete their own discussions. This is a deliberate departure from notes (staff-write-only) — discussions are meant to be more democratic.

**Scope:** A discussion always belongs to a `Project` and optionally to a `Rehearsal`:
- **Project-level** (`rehearsalId IS NULL`): "What is this piece about?" — spans all rehearsals.
- **Rehearsal-anchored** (`rehearsalId` set, no video timestamps): "Big picture for tonight's run."
- **Video-anchored** (`videoAssetId` set, `startTimestampMs` set, `endTimestampMs` optional): "What's the intention here at 1:23?" or "What should this section feel like — heavy / suspended / playful?" (range mode permitted by schema; v1 UI will ship single-timestamp + un-anchored only — range deferred to v1.5).

**Voice support:** Day-one feature reusing the existing `AudioAsset` + Deepgram pipeline. The audio upload-url route accepts `?purpose=discussion` to bypass the staff role gate (so dancers can record voice discussions). Voice requires `rehearsalId` and a video — project-level voice is not supported in v1 because `AudioAsset.rehearsalId` is required at the schema level. Transcription, playback, retry — all reuse the note-side infrastructure (the transcript retry gate has been loosened from staff-only to author-or-staff so dancers can retry their own failed transcripts).

**Tags:** Deferred to v1.5. `Discussion` has no `tag` column today.

#### Data model

| Model | Purpose |
|---|---|
| `Discussion` | Author + body + optional video anchor. `noteType: NoteType @default(TEXT)` reuses the existing enum. `bodyText` nullable (required for TEXT, null for VOICE). `startTimestampMs` and `endTimestampMs` independently nullable (unanchored / single / range modes). `audioAssetId` nullable + `@unique` (1:1 to AudioAsset, same as Note). `projectId` always set; `rehearsalId` and `videoAssetId` optional. |
| `DiscussionComment` | Mirrors `NoteComment` exactly — flat, text-only, soft-delete via `deletedAt`, edited indicator via `editedAt`. |
| `DiscussionReaction` | Mirrors `NoteReaction` — `@@unique([discussionId, userId, kind])` toggle semantics, click-again-to-remove. |
| `DiscussionThreadView` | Mirrors `NoteThreadView` — composite PK on `(discussionId, userId)`, upserted on thread expand. |

**Schema is permissive; integrity rules live in the API.** The create/update routes enforce:
- `rehearsalId`, when set, must belong to `projectId`
- `videoAssetId`, when set, must reference the rehearsal's video AND `rehearsalId` must be set
- timestamps may only be non-null when `videoAssetId` is set
- voice (`noteType = VOICE`) requires `rehearsalId`, `videoAssetId`, `audioAssetId`, and both timestamps

**Cascade behavior:** Deleting a project, rehearsal, or videoAsset cascades to its anchored discussions. This is intentional — a rehearsal-anchored discussion is *about* that rehearsal; losing it when the rehearsal is removed is honest. Soft-delete on User does not cascade (historical attribution preserved, same as notes).

#### Server helpers

| File | Responsibility |
|---|---|
| [lib/discussions/get-discussion-for-user.ts](lib/discussions/get-discussion-for-user.ts) | Auth helper mirroring the `get*ForUser()` family. Used by mutation routes (PATCH/DELETE) to combine ownership + access checks in one Prisma round-trip. Returns `null` when not found or not visible. Caller is responsible for the author-only check on PATCH/DELETE. |
| [lib/discussions/get-discussions-for-rehearsal.ts](lib/discussions/get-discussions-for-rehearsal.ts) | Workspace-scoped list. Includes `summarizeThread`-shaped slices (comments / reactions / viewer's threadViews) so chip seeds compute server-side without a client round-trip. Same pattern as `getRehearsalForUser` for notes. |
| [lib/discussions/get-discussions-for-project.ts](lib/discussions/get-discussions-for-project.ts) | Project-page list — both project-level (`rehearsalId IS NULL`) and rehearsal-anchored ones rolled up. Includes the rehearsal title for the "Rehearsal: {title}" badge. Capped at 50 in v1; promote to cursor pagination if it grows hot. |

#### Thread architecture (shared with notes)

Discussion threads use the same `<ThreadAttachment />` component family as note threads, parameterized over `ThreadTarget` (`{ type: "note" | "discussion"; id: string }` from [lib/threads/api-paths.ts](lib/threads/api-paths.ts)). Server-side, `canViewThread` and `loadThread` in [lib/threads/thread-access.ts](lib/threads/thread-access.ts) switch on `target.type` and walk the appropriate access chain (note → rehearsal → project → team for notes; discussion → project → team for discussions — one less hop). The discussion comment/reaction/view *tables* are separate (`DiscussionComment`, etc.) but the *components and helpers* are shared, so adding the next thread surface costs just a Prisma model trio plus a switch arm.

#### Permissions

| Action | Who |
|---|---|
| View discussion thread | Any team member of the project's team |
| Author a discussion | Any team member (**including DANCER**) |
| Edit / delete own discussion | Author only |
| Post comment | Any team member |
| Edit / delete own comment | Comment author only |
| Toggle reaction | Any team member |
| Bump `DiscussionThreadView` | Self (the viewer) |

No admin-override delete in v1 — escape hatch is a SQL update. Soft-delete on `DiscussionComment` preserves the row + timestamps so recovery is trivial.

#### What this PR ships (PR 2)

Schema + 12 API routes + auth/access helpers + contract types. **No UI yet** — the workspace switcher, project-page section, and dashboard surfacing land in PRs 3–5. End-to-end verifiable today via curl or Postman.

#### Deferred (explicit non-goals for v1)

Tags (v1.5), range-timestamp picker UI (schema permits, UI ships single-timestamp + unanchored only), pinned/featured discussions, archive, "answered" status, voice on project-level discussions, cross-project search, @mentions, notifications, realtime updates. Most of these accommodate at the schema level when their day comes.

### Project Resources

Reference artifacts attached to a project — running orders, choreography references, shared spreadsheets, costume sheets, anything the team needs to point at while rehearsing. Where a `Note` is "follow through on this correction" and a `Discussion` is "let's talk about this creative question," a `ProjectResource` is "here's the document we keep pointing at."

**Defining contrast with notes and discussions:**
- **No threads.** No comments, no reactions, no unread tracking. Resources are reference material — if a team wants to discuss one, they start a discussion. Keeps the model small and the UI focused.
- **No status, no assignment.** A resource is either there or not. No follow-through.
- **Staff-only authoring.** Same role set as notes (`ADMIN | INSTRUCTOR | ASSISTANT`) — production documents flow downward from authority, the same direction notes flow. This is a deliberate contrast with discussions (anyone authors) and the load-bearing distinction for resources.

**Scope:** Always project-scoped. The schema reserves a nullable `rehearsalId` for the v1.5 "anchor a resource to a rehearsal" UI (e.g. "tonight's call sheet"), but v1 surfaces everything at the project level. Cascade-on-rehearsal-delete is `SetNull` (not `Cascade` like Discussion) — a "warm-up routine" PDF should demote to project-level if the rehearsal is removed, not vanish. Reference material outlives the anchor.

**Resource types:** v1 ships `LINK` only — a titled external URL with an optional description. v1.5 will add `FILE` via a separate `FileAsset` table (clone of the `AudioAsset` shape, same two-step `upload-url → GCS PUT → complete` flow). The enum variant is reserved in the schema.

#### Data model

| Model | Purpose |
|---|---|
| `ProjectResource` | `resourceType: ResourceType @default(LINK)`. `title` and `url` required; `description?` optional (≤ 280 chars at the validation layer — the column itself is unbounded, matching the convention used for `Project.title`, `Note.bodyText`, etc.). `rehearsalId?` reserved for v1.5. `@@index([projectId, createdAt])` for the list query, `@@index([rehearsalId])` for the v1.5 anchor filter, `@@index([createdByUserId])` matching other models with `createdBy`. |

**Cascade rules** (intentional — see migration `add_project_resources`):
- `Project ON DELETE CASCADE` — resources die with their project.
- `Rehearsal ON DELETE SET NULL` — resource demotes to project-level, doesn't get deleted.
- `User ON DELETE RESTRICT` — protects attribution. (Users are never hard-deleted anyway — see "User soft-delete + reclaim".)

#### Server helpers

| File | Responsibility |
|---|---|
| [lib/resources/types.ts](lib/resources/types.ts) | `ProjectResourceRow` (flat row shape consumed by UI directly) + `ProjectResourceAuthor` sub-shape. `resourceType` typed as the Prisma enum so v1.5's `FILE` auto-widens. Dates kept as `Date` objects — Next.js handles server → client serialization natively. |
| [lib/resources/validation.ts](lib/resources/validation.ts) | Zod schemas (`createResourceSchema`, `updateResourceSchema`) + length constants (`RESOURCE_TITLE_MAX = 120`, `RESOURCE_URL_MAX = 2048`, `RESOURCE_DESCRIPTION_MAX = 280`). URL validator accepts only `http:` and `https:` — blocks `javascript:`, `data:`, `file:`, etc. Description collapses to `null` when empty so the row doesn't render a dangling separator. |
| [lib/resources/get-resources-for-project.ts](lib/resources/get-resources-for-project.ts) | List helper, newest-first, capped at 100. Returns the flat `ProjectResourceRow[]` so the page entry is one line. Doesn't gate on team membership itself (caller verifies via `getProjectForUser`) — matches the `getDiscussionsForProject` convention. |
| [lib/resources/get-resource-for-user.ts](lib/resources/get-resource-for-user.ts) | Single-row auth helper. Walks resource → project → team → members in one Prisma round-trip. Returns `null` when not found or not visible; caller does the author-only check on mutations. One hop fewer than the note helpers since resources don't require a rehearsal. |

#### Server actions

Resources use **server actions**, not API routes — match the `group-actions.ts` pattern since the surface is small, dialog-less, and tied to a form. The actions live in [app/projects/[projectId]/resource-actions.ts](app/projects/[projectId]/resource-actions.ts):

| Action | Auth | Behavior |
|---|---|---|
| `createResource(_, formData)` | `getProjectForUser` + role ∈ `AUTHOR_ROLES` | Insert + `revalidatePath` |
| `updateResource(_, formData)` | `getResourceForUser` + author-only | Update + `revalidatePath` |
| `deleteResource({ resourceId })` | `getResourceForUser` + author-only | Delete + `revalidatePath` |

`AUTHOR_ROLES = { ADMIN, INSTRUCTOR, ASSISTANT }` — same staff set as note authoring. Author-only edit/delete matches the note + discussion convention (no admin-override delete in v1; escape hatch is SQL).

API request types live in [lib/api/contracts.ts](lib/api/contracts.ts) (`CreateResourceRequest`, `UpdateResourceRequest`) — currently consumed only by the server actions, but pre-positioned so future API routes share one shape with the validation layer.

#### UI placement

Rail card on `/projects/[projectId]`, stacked below `ProjectGroupsSection` on desktop and surfaced as the third tab (`Rehearsals / Groups / Resources`) on mobile. Groups sits above Resources in the desktop rail because groups drive note targeting (structurally more load-bearing).

| File | Responsibility |
|---|---|
| [app/projects/[projectId]/project-resources-section.tsx](app/projects/[projectId]/project-resources-section.tsx) | Single-file rail card following the `project-groups-section.tsx` convention. Contains: `ProjectResourcesSection` (exported), `EmptyResources` (CTA for staff, muted line for dancers), `ResourceForm` (shared by create + edit via a discriminated `mode` prop), `ResourceRow` (display state that swaps to `ResourceForm` when `isEditing`), and `ResourceActionsMenu` (author-only `…` overflow with Edit / Delete). Helpers: `extractDomain` (cheap client-side `URL` parse for the row's domain hint), `isEdited` (60s grace window — Prisma's `updatedAt` ticks on insert), `firstName`, `formatRelative`. |

**Row anatomy**: `Link2` icon + title (`<a target="_blank" rel="noopener noreferrer">` — only the title is the link, so the `…` menu doesn't conflict) + small `ExternalLink` icon that animates to `--primary` on hover/focus + domain hint + optional description (`line-clamp-1`) + author `AvatarInitials` + first name + relative time + optional `· edited`. The `…` overflow reserves a `size-6` placeholder when hidden so author and non-author rows align consistently.

**Form UX details**:
- Title field autofocuses on mount (both create and edit).
- URL field is `<Input type="url" inputMode="url">` with explicit `text-base` to prevent iOS auto-zoom on focus.
- Description char counter only appears within 40 characters of the cap (mirrors the comment composer's "quiet until needed" pattern).
- Cmd/Ctrl + Enter on the description textarea submits the form (matches comment composer).
- Edit swaps the row content in-place rather than opening a modal — preserves spatial context.
- Delete uses `window.confirm` with the resource title in the prompt; same convention as comment delete.

**Three-tab layout on mobile** ([app/projects/[projectId]/project-mobile-tabs.tsx](app/projects/[projectId]/project-mobile-tabs.tsx)): each tab button gets `min-w-0 flex-1` so the count pill can't bleed out of the tablist on 320px-class viewports; below `sm:`, the buttons drop to `text-[13px]` with `px-2 gap-1` and the label is wrapped in `truncate` while the count pill keeps `shrink-0` (label gives way first if anything has to). At `sm:+` everything returns to the original `text-sm px-3 gap-1.5` sizing.

#### Permissions

| Action | ADMIN | INSTRUCTOR | ASSISTANT | DANCER |
|---|:---:|:---:|:---:|:---:|
| View resources | ✓ | ✓ | ✓ | ✓ |
| Click through to URL | ✓ | ✓ | ✓ | ✓ |
| Add resource | ✓ | ✓ | ✓ | |
| Edit / delete own resource | ✓ | ✓ | ✓ | |

#### Deferred (explicit non-goals for v1)

`FILE` uploads (`FileAsset` table + GCS pipeline + file-type icons), rehearsal-anchoring UI (`rehearsalId` column already reserved), categories / tags, pinning / featuring, manual reordering, threads on resources (the discussion entity already exists for that conversation), search across resources, bulk actions, `og:image` / page-title scraping (SSRF concerns; the domain hint is the cheap stand-in).

### Repeating-correction detection

A "repeating cluster" exists when the **same dancer** has **≥3 active assignments** (status OPEN or IN_PROGRESS) with the **same tag** in the **same project**. Threshold and rule live in [lib/notes/repeating.ts](lib/notes/repeating.ts) as `REPEATING_THRESHOLD = 3`.

- **Pure derivation** — no new tables. `detectRepeatingClusters(assignments)` groups active assignments by `(projectId, userId, tag)` and returns groups meeting the threshold. Mirrors the [stalled.ts](lib/notes/stalled.ts) pattern.
- **Project-scoped** — cross-project clustering would surface stale signals from past shows. Same-tag notes from different projects don't combine.
- **Helpers**: `buildRepeatingMarkerByAssignmentId(clusters)` produces a `Map<assignmentId, { tag, count }>` for O(1) lookup when rendering rows; `indexClustersByUserAndTag(clusters)` powers the drill board's per-dancer per-tag grouping.
- **Server-side query**: [lib/notes/get-active-assignments-for-project.ts](lib/notes/get-active-assignments-for-project.ts) returns assignments with status absent OR `OPEN` OR `IN_PROGRESS` for the given projects, with the `note.tag` and user info needed for cluster detection. Called once per request from `/my-notes`, `/notes-by-me`, the project page, and the rehearsal workspace page.
- **Display**: [components/repeating-chip.tsx](components/repeating-chip.tsx) — token-tinted (`--repeating-{bg,fg,border}`, plum/violet hue ~285) chip with the `Repeat` icon. `compact` mode shows only `Repeating × 3` (used inline next to a `StatusChip`); full mode shows `Repeating · Timing × 3`. The presentational chip stays pure — interactive expansion is a separate wrapper, see "Expandable cluster details" below.

**Surfacing rules**:
- Workspace `NoteRow` — per-recipient chip in compact mode next to the `StatusChip` (a single note can be repeating for one recipient, not for another).
- `/my-notes` `AssignedNoteCard` — full chip in the top meta row when this user's assignment is in a cluster.
- `/notes-by-me` `RecipientPipRow` — small `Repeat` icon decoration next to the per-pip status dot. (`/notes-by-me` is staff-only by virtue of being the author dashboard.)
- `/notes-by-me` `AuthorSummaryStrip` — fourth metric tile "Repeating: N dancers" only renders when N > 0; the strip's grid switches from 3-col to 4-col when shown.
- Project page `RepeatingClustersCard` — **staff-only** (Admin / Instructor / Assistant). Surfaces every dancer's cluster by name, which concentrates per-dancer struggle data in a way meant for instructors, not peers. Dancers don't see this card on the project page; their personal repeating-cluster signals still surface on `/my-notes` cards via the `RepeatingChip` and on the drill view's "Recurring drills" header.

#### Expandable cluster details

In drill surfaces (both `/my-notes?view=drill` and the project page) the `RepeatingChip` becomes interactive — clicking it expands an inline panel that shows the cluster's underlying timestamps, the most-recent note's body (text or voice transcript), and a "View latest note" link. Turns the flag from decorative into actionable.

| File | Responsibility |
|---|---|
| [components/expandable-repeating-chip.tsx](components/expandable-repeating-chip.tsx) | `<ExpandableRepeatingChip detail compact? size?>` — `<button>`-wrapped variant of `RepeatingChip` that toggles an inline `RepeatingClusterDetails` panel. Consumes `RepeatingClusterExpansionProvider` when mounted; falls back to local `useState` standalone. Adds a `ChevronDown` indicator that rotates with state. |
| [components/repeating-cluster-details.tsx](components/repeating-cluster-details.tsx) | The inline panel. Quoted "Latest instance" body (Mic icon for voice / FileText for text; transcript-aware), N clickable timestamp pills capped at 8 + "+M more" suffix for very large clusters, "View latest note in {rehearsalTitle}" link. Carries `data-print-hidden` so expanded panels disappear from the printed drill sheet. |
| [components/repeating-cluster-expansion-context.tsx](components/repeating-cluster-expansion-context.tsx) | `RepeatingClusterExpansionProvider` + `useRepeatingClusterExpansion()` hook. Same shape as `ThreadExpansionProvider`: tracks expanded keys as a `Set<string>`, one panel on mobile (single-open rule for clarity), many on desktop (≥ `lg`, for side-by-side cluster comparison). Pre-hydration `useMediaQuery` returns `null` and is treated as mobile to avoid multi-expansion flash. Each surface mounts its own provider — independent coordination scopes. |

**New types in [lib/notes/repeating.ts](lib/notes/repeating.ts)**: `RepeatingClusterDetailItem` (per-assignment row carrying `noteType`, `bodyText`, `voiceTranscript`, `audioDurationMs`, `rehearsalId`/`rehearsalTitle`, `startTimestampMs`, `createdAtMs`) and `RepeatingClusterDetail` (`{ key, tag, count, items }` where items are pre-sorted newest-first server-side, and `key` is the expansion-coordinator key — `${tag}` on `/my-notes` since the viewer is implicit, `${userId}-${tag}` on project surfaces).

**Built server-side**: each page entry (`/my-notes/page.tsx`, `/projects/[id]/page.tsx`) walks its `projectActiveAssignments` set, filters to cluster members, sorts each cluster's items by `createdAt` desc, and threads the `RepeatingClusterDetail[]` down to the drill view. Voice transcripts are only included when `transcriptStatus === "READY"` — the panel falls back to a `"Voice note · 0:32"` placeholder otherwise (matches the row-level behavior).

**Where the chip is interactive vs. plain**: `DrillTagSection` takes an optional `repeatingDetail` prop. When set, it renders `<ExpandableRepeatingChip>` in the header; when unset (or no cluster on the tag), the plain `<RepeatingChip>`. The `RepeatingClustersCard` rows do the same — when a matching `RepeatingClusterDetail` is in the lookup map, the row becomes expandable with a chevron; otherwise the "N unresolved" text renders static.

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
- **`getCurrentDbUser()`** ([lib/auth/get-current-db-user.ts](lib/auth/get-current-db-user.ts)) — use in read-only server components. Looks up the existing row without syncing. Filters soft-deleted rows (`deletedAt IS NOT NULL`) — see "User soft-delete + reclaim" below.

Both return `null` when unauthenticated. Standard guard:
```typescript
const dbUser = await ensureDbUser();
if (!dbUser) return { error: "You must be signed in." };
```

### Auth UI hardening (sign-in / sign-up)

Both [sign-in-form.tsx](app/sign-in/sign-in-form.tsx) and [sign-up-form.tsx](app/sign-up/sign-up-form.tsx) defend against the failure modes real users hit:

- **Friendlier error messages** — [lib/auth/clerk-error-message.ts](lib/auth/clerk-error-message.ts) maps known Clerk error codes (`form_password_pwned`, `form_identifier_exists`, `session_exists`, etc.) to actionable text. Falls back to Clerk's `longMessage` / `message`.
- **OAuth watchdog** — `signIn.sso()` / `signUp.sso()` are wrapped with a 6s timeout. If the SDK is in a stale state (e.g. from a prior failed attempt) the OAuth call can hang silently — the watchdog resets busy state and surfaces an error pointing at the support email.
- **Status branching after `create()`** — instead of assuming `signIn.create()` / `signUp.create()` produces a "ready to finalize / send code" state, both forms check `signIn.status` / `signUp.status` and surface specific messages for `needs_second_factor`, etc.
- **Already-signed-in redirect** — `/sign-in/[[...sign-in]]/page.tsx` and `/sign-up/[[...sign-up]]/page.tsx` are async server components that call `auth()` and redirect to `/dashboard` if the user has a session. Prevents the "you're already signed in" cascade.
- **`[auth]`-prefixed `console.error`** on every error path — surfaces failures in Vercel runtime logs so reports of "I couldn't sign in but there's nothing in the logs" stop being a thing.
- **"Having trouble?" support link** below both forms and the verify-email step — linked `mailto:` to `lgomez00714@gmail.com` (matches the privacy page's `CONTACT_EMAIL`). Update both files together when the support email changes.

### User soft-delete + reclaim

Users are **never hard-deleted** from the DB — the foreign-key chain (notes, projects, rehearsals, assignments, invitations, etc.) makes hard delete a multi-table SQL surgery that destroys historical attribution. Instead, `User.deletedAt: DateTime?` marks a row as removed; the row stays so all relations remain valid, but `deletedAt IS NOT NULL` rows are filtered out of "active member" surfaces.

**Reclaim**: when someone signs up again with the same email as a soft-deleted (or Clerk-side-deleted, but Neon-side-orphaned) row, [`ensureDbUser`](lib/auth/ensure-db-user.ts) detects the email match, attaches the new `clerkUserId` to the existing row, and clears `deletedAt`. The user gets their notes / team memberships / history back automatically. No manual SQL, no data loss. This relies on `User.email` being `@unique` — no two real users can collide.

**What "active member" means**: queries that drive team rosters, audience pickers, and group memberships filter `user: { deletedAt: null }` so removed users disappear. Queries that surface *historical attribution* (note authors, existing assignment recipients) deliberately don't filter — the note still exists, the assignment still has its history, the user's name still renders. Specific filtered call sites:
- [app/teams/[teamId]/page.tsx](app/teams/[teamId]/page.tsx) — team member roster
- [app/projects/[projectId]/page.tsx](app/projects/[projectId]/page.tsx) — cast list driving "Manage cast"
- [lib/rehearsals/get-rehearsal-for-user.ts](lib/rehearsals/get-rehearsal-for-user.ts) — `team.members` for the audience picker
- [lib/groups/get-project-groups.ts](lib/groups/get-project-groups.ts) — group membership lists
- [app/teams/[teamId]/member-actions.ts](app/teams/[teamId]/member-actions.ts) — invite-flow existence check (a soft-deleted user with the same email shouldn't block a fresh invite; reclaim handles re-attaching their old data on sign-up)

**Triggering soft-delete**: there's no automated path yet. Two manual options:
1. SQL: `UPDATE "User" SET "deletedAt" = NOW() WHERE id = '<user_id>';`
2. Clerk webhook on `user.deleted` (deferred — wire a handler at `/api/webhooks/clerk` if/when needed).

**Tradeoffs we're explicitly accepting**: silent reclaim trusts email-match as proof of identity. For a B2B beta with admin-controlled invites this is a reasonable simplification, but a consumer-facing version would want a consent UI ("An account previously existed at this email — reclaim or start fresh?") and an audit log. Don't apply this pattern blindly to other entities.

## Authorization

Use `get*ForUser()` functions that verify access through the ownership chain:
- `getTeamForUser(teamId, userId)` — checks `TeamMember` exists
- `getProjectForUser(projectId, userId)` — checks via team membership
- `getRehearsalForUser(rehearsalId, userId)` — checks via project → team
- `getDiscussionForUser(discussionId, userId)` — checks via project → team (one less hop than note access — discussions don't require a rehearsal)

All return `null` if unauthorized. Never skip these and query directly.

**Asset uploaders own completion**: The `POST /api/video-assets/[id]/complete` and `POST /api/audio-assets/[id]/complete` endpoints gate on `uploadedByUserId === currentUser` rather than team membership. The companion upload-URL endpoints already gate on the relevant author/manager role at upload time, so the uploader-only check is the natural narrow gate for the second half of the two-step flow — preventing other team members (even other authors) from completing someone else's in-flight upload.

## Team Invitations

Team membership grows by **email invitation** — admins enter an email + role, the recipient gets a magic link, clicks it, signs in (or signs up if they're new), and the `TeamMember` row is created on accept. Same flow whether the recipient already has an Eight Count account or not. The invitation and the auth account are decoupled: Clerk owns account creation, the app owns the invitation record + email + accept flow, and the two meet at the **email match** check at acceptance time.

### Data model

| Field | Notes |
|---|---|
| `tokenHash` | SHA-256 of the raw token. Raw value lives only in the email URL — same pattern as password resets. Hashing means a DB leak doesn't grant accept access. |
| `status` | `PENDING` → terminal `ACCEPTED` / `REVOKED` / `EXPIRED`. Lazy expiry: `expiresAt < now` is rewritten to `EXPIRED` on the first accept attempt after expiry, no cron required. |
| `expiresAt` | 7 days (`INVITATION_TTL_DAYS` in [lib/invitations/token.ts](lib/invitations/token.ts)). Resend rotates the hash and resets the timer. |

### Files

| File | Responsibility |
|---|---|
| [lib/invitations/token.ts](lib/invitations/token.ts) | `generateInvitationToken()` returns `{ raw, hash }` (32-byte base64url + sha256). `hashInvitationToken(raw)` for lookup. `invitationExpiry()` builds the `expiresAt` timestamp. |
| [lib/invitations/lookup.ts](lib/invitations/lookup.ts) | Server-side resolver: hashes the raw token from the URL, returns a discriminated result (`ok` / `not_found` / `expired` / `revoked` / `accepted`). Used by the acceptance page to render the right state without leaking detail. |
| [lib/email/send.ts](lib/email/send.ts) | Resend wrapper. `sendInvitationEmail({ to, teamName, inviterName, role, rawToken, expiresAt })` builds the accept URL from `NEXT_PUBLIC_APP_URL`, picks the from address (env `EMAIL_FROM` or `Eight Count <onboarding@resend.dev>` fallback), and sends both HTML and text bodies. Lazy-instantiates the Resend client and throws on missing `RESEND_API_KEY`. |
| [app/teams/[teamId]/member-actions.ts](app/teams/[teamId]/member-actions.ts) | Three server actions: `inviteTeamMember` (admin gate → blocks self-invite, existing member, duplicate `PENDING` invite for same email → creates row → sends email), `revokeInvitation` (admin gate → flips `PENDING` to `REVOKED`, killing the token), `resendInvitation` (admin gate → rotates `tokenHash`, resets `expiresAt`, re-sends email; works for `PENDING` and `EXPIRED`). All return `{ success?, error? }` and `revalidatePath` the team page. |
| [app/api/invitations/[token]/accept/route.ts](app/api/invitations/[token]/accept/route.ts) | `POST` handler. Auth via `ensureDbUser()` → 401 if signed-out. Status checks (revoked / accepted / expired). **Email match**: signed-in user's email must equal `invitation.email`, otherwise returns `EMAIL_MISMATCH`. Idempotent — if the `TeamMember` already exists (e.g. user double-clicks), still marks the invite `ACCEPTED`. Returns `{ teamId, teamName }` for the client redirect. |
| [app/invite/[token]/page.tsx](app/invite/[token]/page.tsx) | Server-rendered acceptance page. Calls `lookupInvitationByToken` + `getCurrentDbUser()` in parallel, then renders one of: `SignedOutInviteCard`, `AcceptInvitationCard` (matching email), wrong-account state (mismatched email), or info card (not_found / expired / revoked / accepted). Brand lockup mounted at the top. **Public route** — not gated by `proxy.ts` so signed-out users can see the invite + sign-up CTA. |
| [app/invite/[token]/signed-out-invite-card.tsx](app/invite/[token]/signed-out-invite-card.tsx) | Server component. Renders team + role + inviter line, plus two CTAs: "Create account" → `/sign-up?email={invited}&redirect_url=/invite/{token}`, "I already have an account" → `/sign-in?redirect_url=/invite/{token}`. The pre-filled `?email=` plus the read-only field on `/sign-up` guarantees the new account uses the invited address, so the email-match check passes after they bounce back. |
| [app/invite/[token]/accept-invitation-card.tsx](app/invite/[token]/accept-invitation-card.tsx) | Client. The matching-email branch renders the Accept button which `POST`s to the accept route and `router.push`es to `/teams/{teamId}` on success. The wrong-account branch calls `clerk.signOut({ redirectUrl: /sign-in?redirect_url=/invite/{token} })` so the user re-enters auth pointed back at the invite. |
| [app/teams/[teamId]/pending-invitation-row.tsx](app/teams/[teamId]/pending-invitation-row.tsx) | Muted row rendered above the active members list. Avatar (initials from email) + email + "Pending" pill (in-progress tint) + "Invited Xd ago" + role chip + admin `…` menu (`Resend invite` / `Copy email` / `Revoke`). Uses `useTransition` for menu actions; sonner toasts on result. |

### Sign-up email pre-fill

[app/sign-up/sign-up-form.tsx](app/sign-up/sign-up-form.tsx) reads `?email=` via `useSearchParams()` (sanitized through `sanitizeEmailParam`: trim, regex check, lowercase). When present, the email field is pre-filled and `readOnly` with a "Locked to your invited email" hint. This is the load-bearing piece that ensures the new account is created at the invited address — without it, a user could sign up with a different email and the accept route would fail the email-match check.

### Signed-in path

If the recipient is already signed in with the invited email when they click the link, the page short-circuits to `AcceptInvitationCard` immediately — one button click, no sign-in detour. If signed in with a different email, the wrong-account state explains the mismatch and routes them through sign-out → sign-in.

### Why we don't use Clerk's invitation API

Clerk has its own `clerkClient.invitations.createInvitation()` that pre-creates a ticket and skips the verification code at sign-up. We don't use it because:
- Clerk's emails are off-brand vs. the headless auth UI in the rest of the app.
- Coupling team metadata (role, status, revocation, resend) to Clerk's invitation state would split the source of truth.
- The lazy-sync via `ensureDbUser()` already handles "Clerk account just got created → upsert local `User` row" without webhooks.

If sign-up's 6-digit verification ever feels like friction, the optimization is to layer Clerk invitations *on top of* our `TeamInvitation` (Clerk's ticket auto-verifies the email at sign-up; our row still owns admin UX), but it's deferred.

## Auth UI

Sign-in / sign-up are **fully headless**. Clerk handles the auth flow under the hood (`useSignIn` / `useSignUp` from `@clerk/nextjs`), but every input, button, divider, OAuth pill, and verification step is built from the app's own primitives. The only Clerk-rendered surfaces still in the app are the `<UserButton>` dropdown (when signed in) and the transient `<AuthenticateWithRedirectCallback />` on the OAuth return page.

> See "Auth UI hardening" under the Authentication section above for the defensive patterns layered on top of these forms — friendlier error messages, OAuth watchdog, status branching, already-signed-in redirects, `[auth]`-prefixed logging, and the support fallback link.

| File | Responsibility |
|---|---|
| [app/sign-in/[[...sign-in]]/page.tsx](app/sign-in/[[...sign-in]]/page.tsx) | Server-rendered split-screen page. Brand panel on the left (`hidden lg:flex` — mobile drops it entirely since the AppHeader already owns brand identity at that viewport) renders `<BrandLockup size="lg" showCountDots />` plus the heading + supporting paragraph + small footer line. `<SignInForm />` centered on the right. |
| [app/sign-in/sign-in-form.tsx](app/sign-in/sign-in-form.tsx) | Client. Built on Clerk's "Future" API: `signIn.create({ identifier, password })` → check `signIn.status === "complete"` → `signIn.finalize()` → `router.push(redirectAfter)`. Google OAuth via `signIn.sso({ strategy: "oauth_google", redirectUrl, redirectCallbackUrl: "/sign-in/sso-callback" })`. RHF + Zod validation, sonner-style errors at the form level, `<div id="clerk-captcha" />` mounted hidden for Clerk's bot protection. |
| [app/sign-up/[[...sign-up]]/page.tsx](app/sign-up/[[...sign-up]]/page.tsx) | Mirror of the sign-in page (same `<BrandLockup size="lg" showCountDots />` + sign-up-specific copy), renders `<SignUpForm />`. |
| [app/sign-up/sign-up-form.tsx](app/sign-up/sign-up-form.tsx) | Two-state component. **Step 1 (`create`)**: `signUp.create({ emailAddress, password })` → `signUp.verifications.sendEmailCode()` → flip to step 2. **Step 2 (`verify`)**: `signUp.verifications.verifyEmailCode({ code })` → `signUp.finalize()` → redirect. Resend button (idle / sending / sent states) and "← Use a different email" back-link. Google OAuth fast path via `signUp.sso(...)` skips verification. **Email pre-fill**: reads `?email=` (sanitized via `sanitizeEmailParam`) and renders the email field pre-filled and `readOnly` with a "Locked to your invited email" hint — used by the team-invitation flow to guarantee the new account uses the invited address. **18+ gate**: a required `confirmAdult` checkbox above the OAuth + form sit on a small disclaimer card linking to `/privacy#who`. Zod-validated via `z.boolean().refine((v) => v === true, ...)`; `handleGoogle` short-circuits with the same error if the box is unchecked, so OAuth can't bypass the email path. The checkbox is the sole age affirmation — there's no DOB collection — so it's the load-bearing piece for the beta's 18+ scope. |
| [app/sign-in/sso-callback/page.tsx](app/sign-in/sso-callback/page.tsx) | OAuth landing page. Renders Clerk's `<AuthenticateWithRedirectCallback />` plus a centered loader. Used for both sign-in and sign-up OAuth flows (Clerk routes correctly internally). |

**Deep-link preservation**: both forms read `?redirect_url=` from `useSearchParams()` and route the user back to that path after auth. `resolveRedirect()` sanity-checks the value (must start with `/` and not `//`) and falls back to `/dashboard` otherwise.

**Navbar buttons** ([components/app-header.tsx](components/app-header.tsx)): `<SignInButton mode="redirect" forceRedirectUrl="/dashboard">` and `<SignUpButton mode="redirect" forceRedirectUrl="/dashboard">` — `mode="redirect"` sends users to our custom routes, `forceRedirectUrl` guarantees the landing.

**Required env vars** to wire middleware + navbar to the custom routes:
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

**Sign-out**: `<ClerkProvider afterSignOutUrl="/">` in [app/layout.tsx](app/layout.tsx) — users land on the landing page, not a stale signed-in URL.

**Why headless**: Clerk's `appearance` prop (both `variables` and `elements`) refused to propagate to the rendered modal in this app's setup despite multiple attempts (var() refs, hardcoded oklch values, theme-aware wrappers, element overrides, even raw CSS targeting `.cl-*` classes with `!important`). Going fully headless replaces every input / button / label with the app's own components — no Clerk runtime processing the styling, no specificity wars, no surface where theming can fail. Trade-off: forgot-password is currently linked out to Clerk's hosted reset URL; building it inline uses `signIn.resetPasswordEmailCode.{sendCode, verifyCode, submitPassword}` and is structurally similar to the sign-up verification step (deferred for later).

## Theming & dark mode

`ThemeProvider` ([components/theme-provider.tsx](components/theme-provider.tsx)) is mounted in [app/layout.tsx](app/layout.tsx) (wraps everything inside `<body>`). Built on `next-themes` with `attribute="class"`, `defaultTheme="system"`, and `disableTransitionOnChange`.

| File | Responsibility |
|---|---|
| [components/theme-provider.tsx](components/theme-provider.tsx) | Thin wrapper around `next-themes`'s provider with the app's defaults (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`). No global keyboard shortcut — theme is changed exclusively via the header `<ThemeToggle>`. |
| [components/theme-toggle.tsx](components/theme-toggle.tsx) | Three-state `DropdownMenuRadioGroup` (Light / Dark / System) in the global header. Trigger renders Sun (light) or Moon (dark) based on `resolvedTheme`. Uses a `useState`-deferred `mounted` flag set in `useEffect` so the SSR'd icon is a stable placeholder (avoids hydration mismatch — the server can't know the user's resolved theme). |

All design tokens (`--primary`, `--card`, `--status-*`, `--note-voice-*`, `--avatar-tone-*`) are defined in both `:root` and `.dark` scopes in [app/globals.css](app/globals.css), so any component using `var(--*)` adapts automatically. No theme-aware wrappers, no per-component dark variants.

## Role-Based Permissions

| Action | ADMIN | INSTRUCTOR | ASSISTANT | DANCER |
|---|:---:|:---:|:---:|:---:|
| Invite / revoke / resend team invitations | ✓ | | | |
| Create/archive projects | ✓ | ✓ | | |
| Manage project groups | ✓ | ✓ | | |
| Create rehearsals / upload video / author notes (text or voice) | ✓ | ✓ | ✓ | |
| Edit or delete own notes | ✓ | ✓ | ✓ | |
| Update their own note status | ✓ | ✓ | ✓ | ✓ |
| See project-page drill board + repeating clusters card + Manage cast button | ✓ | ✓ | ✓ | |
| See own personal drill list (`/my-notes` Drill view) | ✓ | ✓ | ✓ | ✓ |
| Author discussions (text or voice) | ✓ | ✓ | ✓ | ✓ |
| Edit or delete own discussions | ✓ | ✓ | ✓ | ✓ |
| Post comments + react on any thread | ✓ | ✓ | ✓ | ✓ |
| Retry transcription on own voice recordings | ✓ | ✓ | ✓ | ✓ |
| Retry transcription on someone else's voice recording | ✓ | ✓ | ✓ | |
| Add project resources | ✓ | ✓ | ✓ | |
| Edit or delete own project resource | ✓ | ✓ | ✓ | |
| View / click through project resources | ✓ | ✓ | ✓ | ✓ |

Enforce via `TeamMember.role` after fetching with a `get*ForUser()` function. **Note vs. Discussion authoring is the load-bearing role contrast**: notes (corrections — staff only) flow downward from authority; discussions (creative questions — anyone) flow horizontally across the team. Don't conflate the two when adding new write paths. `ProjectResource` authoring sits on the same staff-only side as notes — production documents flow downward too.

## Server Actions

Action files live alongside their route pages:

| File | Exports |
|------|---------|
| `app/dashboard/actions.ts` | `createTeam()` |
| `app/teams/[teamId]/actions.ts` | `createProject()` |
| `app/teams/[teamId]/member-actions.ts` | `inviteTeamMember()`, `revokeInvitation()`, `resendInvitation()` |
| `app/projects/[projectId]/actions.ts` | `createRehearsal()` |
| `app/projects/[projectId]/group-actions.ts` | `createProjectGroup()`, `updateProjectGroupMembers()`, `deleteProjectGroup()` |
| `app/projects/[projectId]/resource-actions.ts` | `createResource()`, `updateResource()`, `deleteResource()` |
| `app/my-notes/note-status-actions.ts` | `updateNoteAssignmentStatus()` |
| `app/dashboard/onboarding-actions.ts` | `dismissChecklistAction()`, `skipChecklistStepAction(stepKey)`, `dismissTipGroupAction(group)`, `restartOnboardingAction()` |

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
- `POST /api/rehearsals/[rehearsalId]/notes` — create text or voice note (discriminated by `noteType`) with targets + assignments + optional `tag`
- `PATCH /api/notes/[noteId]` — edit note (author-only; type-aware: text edits body+timestamp+tag+targets, voice edits start/end+tag+targets only). Diffs assignments to preserve existing statuses. Tag PATCH semantics: `undefined` leaves untouched, `null` clears, valid enum sets.
- `DELETE /api/notes/[noteId]` — delete note and all its targets/assignments; also deletes the linked `AudioAsset` row for voice notes (author-only)
- `GET /api/rehearsals/[rehearsalId]/audience` — list all audience members and project groups for the target picker UI
- `POST /api/rehearsals/[rehearsalId]/video/upload-url` — generate GCS signed upload URL for video (staff roles only; mp4 / mov / webm). Server-side size cap: 2 GB (`VIDEO_TOO_LARGE`). **Legacy** — new clients use `/upload-session` (below); kept in place for any in-flight clients.
- `POST /api/rehearsals/[rehearsalId]/video/upload-session` — primary path: initiate a GCS resumable upload session for video (staff roles only; mp4 / mov / webm; 2 GB cap). Returns `{ videoAssetId, sessionUri, objectPath, chunkSize }`. See "Video Upload Flow" above.
- `POST /api/video-assets/[videoAssetId]/complete` — mark video upload complete (**uploader-only**: caller must equal `videoAsset.uploadedByUserId`). Verifies the GCS object actually exists before flipping to `READY` — responds `409 UPLOAD_NOT_FOUND` if the upload didn't land, so the row stays at `UPLOADING` for retry. Works regardless of which upload route was used.
- `GET /api/rehearsals/[rehearsalId]/video/playback-url` — get signed video playback URL (1-hr expiry)
- `POST /api/rehearsals/[rehearsalId]/audio/upload-url` — generate GCS signed upload URL for a voice audio asset (25 MB cap; webm/mp4/ogg/mpeg). **Auth gate depends on `?purpose` query param**: default (no param, or any value other than `discussion`) is staff-only (ADMIN / INSTRUCTOR / ASSISTANT) — the voice-note path. With `?purpose=discussion`, gate loosens to "any team member" so dancers can record voice discussions. Both paths share the same route, GCS layout, and `AudioAsset` row shape — purpose just toggles the role check. **Legacy** — new clients use `/upload-session` (below).
- `POST /api/rehearsals/[rehearsalId]/audio/upload-session` — primary path: initiate a GCS resumable upload session for audio. Same auth gate + `?purpose=discussion` behavior as `/upload-url`. Returns `{ audioAssetId, sessionUri, objectPath, chunkSize }`. See "Voice Note Recording Flow" below.
- `POST /api/audio-assets/[audioAssetId]/complete` — mark audio upload complete and store `durationMs` (**uploader-only**: caller must equal `audioAsset.uploadedByUserId`). Verifies the GCS object actually exists before flipping to `READY` — responds `409 UPLOAD_NOT_FOUND` if the PUT didn't land, so the row stays at `UPLOADING` for retry. Also kicks off Deepgram transcription via `after()` — see "Voice Note Transcription" below.
- `GET /api/audio-assets/[audioAssetId]/playback-url` — get signed audio playback URL (1-hr expiry); fetched lazily on first play
- `GET /api/audio-assets/[audioAssetId]/transcript` — get current transcript state (`status`, `transcript`, `transcriptError`) for polling. Auth: any team member of the owning team.
- `POST /api/audio-assets/[audioAssetId]/transcript/retry` — re-trigger transcription for a `FAILED` (or any) row. **Author-or-staff**: the original uploader (so dancers can retry their own voice-discussion transcripts) OR a staff member (ADMIN / INSTRUCTOR / ASSISTANT) on the team. Resets row to `PENDING` and fires a fresh `after(() => runTranscription(...))`.
- `POST /api/invitations/[token]/accept` — accept a team invitation. Auth-gated, status-gated, **email-match-gated** (signed-in user's email must equal the invitation's email). Idempotent on the `TeamMember` row. Returns `{ teamId, teamName }` for the client to redirect into. See "Team Invitations" above.
- `GET /api/notes/[noteId]/comments` — list comments + reactions for a note. Auth: any team member of the note's team (via `canViewThread`).
- `POST /api/notes/[noteId]/comments` — create a comment. Same auth. Body: `{ bodyText }`, trimmed and length-checked (1..2000). Also bumps the author's `NoteThreadView` so their own write doesn't count as unread. See "Note threads" above.
- `PATCH /api/notes/[noteId]/comments/[commentId]` — edit. **Comment-author only**. Sets `editedAt` so the row renders a `· edited` suffix.
- `DELETE /api/notes/[noteId]/comments/[commentId]` — soft delete. **Comment-author only**. Idempotent.
- `POST /api/notes/[noteId]/reactions` — toggle a reaction. Body: `{ kind: ReactionKind }`. Same team-member auth as comments.
- `POST /api/notes/[noteId]/thread/view` — upsert the viewer's `NoteThreadView.lastViewedAt` to `now()`. Fire-and-forget from the client on thread expand; failures are silent.
- `POST /api/projects/[projectId]/discussions` — create a discussion. **Auth: any team member of the project's team** (including dancers — deliberate departure from note authoring). Body discriminated by `noteType: "TEXT" | "VOICE"`. Validates rehearsal/project consistency, video coupling, and the voice-requires-rehearsal rule. See "Discussions" above.
- `GET /api/projects/[projectId]/discussions` — list project discussions (project-level + rolled-up rehearsal-anchored). Capped at 50 in v1.
- `GET /api/rehearsals/[rehearsalId]/discussions` — list discussions filtered to `rehearsalId = X`. Used by the workspace.
- `PATCH /api/discussions/[discussionId]` — edit. **Author of the discussion only**. TEXT edits update body + timestamps; VOICE edits update timestamps only (replacing audio = delete + create new, same as Note voice).
- `DELETE /api/discussions/[discussionId]` — delete. **Author of the discussion only**. Cascade-deletes comments / reactions / thread views; also deletes the linked `AudioAsset` for voice (matches Note delete behavior).
- `GET /api/discussions/[discussionId]/comments` — list comments + reactions. Auth: any team member (via `canViewThread`).
- `POST /api/discussions/[discussionId]/comments` — create comment. Body: `{ bodyText }`. Bumps author's `DiscussionThreadView`.
- `PATCH /api/discussions/[discussionId]/comments/[commentId]` — edit. **Comment-author only**. Sets `editedAt`.
- `DELETE /api/discussions/[discussionId]/comments/[commentId]` — soft delete. **Comment-author only**. Idempotent.
- `POST /api/discussions/[discussionId]/reactions` — toggle a reaction. Body: `{ kind: ReactionKind }`. Same team-member auth as comments.
- `POST /api/discussions/[discussionId]/thread/view` — upsert the viewer's `DiscussionThreadView.lastViewedAt`. Fire-and-forget from the client on thread expand.

Request/response types: [lib/api/contracts.ts](lib/api/contracts.ts) and [lib/api/responses.ts](lib/api/responses.ts). Create/update note request bodies are discriminated unions (`CreateTextNoteRequest | CreateVoiceNoteRequest`); discussion bodies follow the same pattern (`CreateTextDiscussionRequest | CreateVoiceDiscussionRequest`).

## Video Upload Flow

The primary path is **resumable chunked upload** — the single-PUT `/upload-url` route is kept in place for legacy clients but new uploads go through `/upload-session`. The resumable flow survives connection drops, mobile-Safari memory pressure, and slow uplinks that the single PUT couldn't (the original bug: a 145 MB `.mov` from iOS Safari stuck at `UPLOADING` for a week).

1. Client POSTs to `/upload-session` → server creates `VideoAsset` (`UPLOADING`), initiates a GCS resumable upload session via `createResumableUploadSession` ([lib/storage/gcs.ts](lib/storage/gcs.ts)), and returns `{ videoAssetId, sessionUri, objectPath, chunkSize }`. The session URI is valid for **~7 days** (GCS default) — none of the URL-expiry failure modes from the single-PUT path apply. Server-side cap is 2 GB (`MAX_VIDEO_BYTES`) — anything larger is rejected with `VIDEO_TOO_LARGE`.
2. Client uses `uploadResumable` ([lib/upload/resumable-uploader.ts](lib/upload/resumable-uploader.ts)) to PUT 8 MiB chunks directly to the session URI. Each chunk has its own `Content-Range: bytes {start}-{end}/{total}` header; GCS responds with `308 Resume Incomplete` and a `Range` header until the final chunk lands as `200`. Failed chunks retry with exponential backoff (1s → 2s → 4s); aborts (via `AbortSignal`) surface as `UploadAbortedError`; expired sessions (`404/410`) surface as `UploadSessionExpiredError`. Progress is reported continuously via `XMLHttpRequest.upload.onprogress` — `fetch` can't surface PUT body progress, which is why the uploader is XHR-based.
3. Client POSTs to `/complete` with duration → server **verifies the GCS object exists** via `statGcsObject` ([lib/storage/gcs.ts](lib/storage/gcs.ts)) before flipping status to `READY`. If the object is missing (failed/aborted upload followed by a stray /complete), responds `409 UPLOAD_NOT_FOUND` and leaves the row at `UPLOADING` so the client can retry. Same defense-in-depth check on `/api/audio-assets/[id]/complete`.

GCS path: `teams/{teamId}/projects/{projectId}/rehearsals/{rehearsalId}/video/{videoAssetId}-{filename}`

### Upload UI

[upload-video-form.tsx](app/rehearsals/[rehearsalId]/upload-video-form.tsx) is the only mount of the resumable uploader on the video side. While in `phase = "uploading"`, the form renders a `UploadProgressCard` showing: file name, percent, filled `--primary`-tinted bar, `MB / MB · MB/s · ~ETA`, and a Cancel button wired to `controller.abort()`. The two transient phases (`preparing` for `/upload-session`, `finalizing` for `/complete`) keep the same card shape — the bar pulses (`animate-pulse`) at full width and the metric strip swaps to a one-liner — so the UI doesn't restructure mid-upload. Component-unmount aborts any in-flight upload (the DB row is reaped by `db:reap-stale-uploads` after 24 h).

### CORS (one-time bucket setup + per-session origin)

Two-part requirement that's easy to miss:

1. **Bucket CORS** (one-time). The browser's chunked PUTs to `storage.googleapis.com` cross origins, so the bucket needs PUT + `Content-Range` allowed. Apply via `gsutil cors set cors.json gs://{bucket-name}`:

```json
[
  {
    "origin": ["https://your-prod-domain", "http://localhost:3000"],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "Content-Range",
      "Range",
      "x-goog-resumable"
    ],
    "maxAgeSeconds": 3600
  }
]
```

2. **Session origin** (per-request). Bucket CORS alone is **not** sufficient for resumable uploads — GCS only emits `Access-Control-Allow-Origin` on chunk-PUT responses when the session was *initiated* with that `Origin` header. The `/upload-session` routes forward `request.headers.get("origin")` into `createResumableUploadSession({ origin })` in [lib/storage/gcs.ts](lib/storage/gcs.ts), which sets it on the SDK's `createResumableUpload({ origin })` call. Without this, every chunk PUT fails with "No 'Access-Control-Allow-Origin' header" even when the bucket CORS is correct.

If a chunk PUT is rejected with a CORS error in the browser console (`No 'Access-Control-Allow-Origin' header`), check both halves before debugging deeper: `gsutil cors get gs://{bucket}` for (1), and confirm the API route is reading `request.headers.get("origin")` and forwarding it for (2).

### Reaping stalled uploads

The single-PUT pattern has well-known failure modes (tab closed mid-upload, connection drop, browser memory pressure on large mobile-Safari uploads) that can leave a `VideoAsset` or `AudioAsset` row stuck at `status=UPLOADING` forever, because step 3 never fires. The signed-URL expiry bump to 1 h covers most cases, and the `/complete` GCS verification prevents the DB from claiming a missing object is `READY`, but neither cleans up rows that were truly abandoned.

[scripts/reap-stale-uploads.ts](scripts/reap-stale-uploads.ts) — `npm run db:reap-stale-uploads`. Behavior:
- Finds `VideoAsset` and `AudioAsset` rows where `status=UPLOADING` and `updatedAt < now - 24h` (`STALE_THRESHOLD_HOURS`).
- For each, calls `statGcsObject(objectPath)`:
  - **Exists + size > 0** → recover: flip status to `READY`. For audio, also kicks off `runTranscription` (which the row missed when `/complete` didn't fire).
  - **Missing or empty** → delete the DB row. Safe because (a) UPLOADING audio rows have no `Note` pointing at them yet (the Note is only created post-/complete), and (b) the video upload-url route creates a fresh row on retry when one isn't present.
- `DRY_RUN = false` at the top (matches the `db:backfill-transcripts` convention — flip to `true` for a dry-run preview before running for real, then flip back). Always dry-run first when pointing at prod.
- `MAX_PROCESS = 200` cap per run.
- Idempotent.

Not yet automated (no cron). Run manually after upload outage reports; consider scheduling once the project is on a paid Vercel tier.

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
   1. `POST /audio/upload-session` → creates `AudioAsset(UPLOADING)`, initiates a GCS resumable session, returns `{ audioAssetId, sessionUri, chunkSize }`
   2. Blob streamed to GCS via `uploadResumable` ([lib/upload/resumable-uploader.ts](lib/upload/resumable-uploader.ts)). Voice notes are typically small enough to fit in one chunk, but the chunked-retry behavior still applies on transient failures. Upload percent surfaces in the recorder UI as "Saving voice note… N%".
   3. `POST /audio-assets/[id]/complete` → server verifies the GCS object exists, marks `READY`, stores `durationMs`
   4. `POST /rehearsals/[id]/notes` with `noteType=VOICE`, `audioAssetId`, `startTimestampMs`, `endTimestampMs`, `targets`

GCS path: `teams/{teamId}/projects/{projectId}/rehearsals/{rehearsalId}/audio/{audioAssetId}-{filename}`

Mime detection: prefers `audio/webm;codecs=opus`, falls back through `audio/webm`, `audio/mp4;codecs=mp4a.40.2`, `audio/mp4`, `audio/ogg;codecs=opus`. Recording is hard-capped at 2 minutes. On save failure, the blob is retained so the user can retry without re-recording.

**Voice discussions** follow the same 4-step flow with two adjustments. (1) The upload-session request adds `?purpose=discussion` so the route bypasses the staff role gate (any team member, including dancers, can record voice discussions — see "Discussions" above). (2) Step 4 posts to `POST /api/projects/[projectId]/discussions` with `noteType=VOICE`, `rehearsalId` (required), `videoAssetId` (required), `audioAssetId`, and both timestamps — instead of the note-creation route. The GCS path is identical (the audio still belongs to a rehearsal). Project-level voice is **not** supported in v1 because `AudioAsset.rehearsalId` is required at the schema level — text-only at the project scope.

## Voice Note Playback (Sync Mode)

[app/rehearsals/[rehearsalId]/workspace/voice-note-player.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-player.tsx) runs in two modes:

- **Standalone** (used on `/my-notes`, `/notes-by-me`): just plays the audio. Lazy-fetches the signed playback URL on first play click.
- **Synced** (used in the rehearsal workspace, when both `videoRef` and `startTimestampMs` props are passed): clicking play seeks the rehearsal video to `startTimestampMs`, mutes it, and plays the audio + video together. Pausing/ending the audio pauses the video and restores its prior mute state. Manually pausing the video also pauses the audio.

The UI is a custom transport — coral-tinted pill with a circular play / pause button, a 32-bar decorative waveform that fills as playback progresses, and a mono duration label. The native `<audio>` element is still in the DOM (with `ref` + event handlers) but its `controls` are hidden; click-on-bars seeks. The recorder preview state in [voice-note-recorder.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-recorder.tsx) uses the same transport via a local `PreviewPlayer` component (it shows `current / total` time since the verify-before-save flow benefits from precise feedback). The waveform bars are *decorative only* — heights come from a static `Math.sin`-based formula, not real audio analysis.

**Mobile sticky video during sync playback**: while a synced voice note is playing on mobile, the rehearsal video pins to the top of the viewport so the user can keep watching while scrolling the notes thread. Mechanism: each `VoiceNotePlayer` calls `onSyncPlaybackChange(audioAssetId, isPlaying)` from `handleAudioPlay` (when sync engages) and from `stopSync` (when audio pauses, ends, the video is paused, or the player unmounts). The workspace tracks a `Set<string>` of currently-syncing asset IDs so overlapping playback decrements correctly. When the set is non-empty, a wrapper around `RehearsalVideoCard` picks up `max-lg:sticky max-lg:top-0 max-lg:z-20`. Because CSS Grid items only sticky within their cell, the workspace switches the outer container from `grid` to `flex` on mobile and applies `display: contents` to the left-column wrapper so the video and timeline become direct flex children — that makes the video's containing block the entire column, allowing sticky to span the full notes thread. On `lg+` the layout reverts to grid and the existing column-sticky behavior is unchanged.

## Voice Note Transcription

Voice notes are auto-transcribed to text via Deepgram (Nova-3 model, English, smart-format) so the same recording can be skimmed, drilled on, and printed without the audio player. The pipeline is fire-and-forget — the user's "save voice note" flow doesn't wait on transcription, and the transcript shows up underneath the player a few seconds later.

### Schema

`AudioAsset` carries four transcript-related fields:
- `transcript: String?` — the text once it lands. `null` until `transcriptStatus = READY`.
- `transcriptStatus: TranscriptStatus` (`PENDING | PROCESSING | READY | FAILED`, default `PENDING`).
- `transcriptError: String?` — failure message (truncated to 500 chars) when status = `FAILED`. Surfaced to staff on retry.
- `transcribedAt: DateTime?` — set when `READY` is written.

There's an `@@index([transcriptStatus])` on `AudioAsset` so the backfill scan (`WHERE transcriptStatus = 'PENDING'`) is fast.

### Pipeline

| File | Responsibility |
|---|---|
| [lib/transcription/deepgram.ts](lib/transcription/deepgram.ts) | REST wrapper for Deepgram's `/v1/listen` endpoint. POSTs the GCS signed URL (Deepgram fetches the audio itself — we never re-upload bytes from our server). 30s `AbortController` timeout. Throws `TranscriptionError` on any failure. |
| [lib/transcription/run.ts](lib/transcription/run.ts) | Orchestrator. Marks `PROCESSING`, signs the URL via `createSignedReadUrl`, calls `transcribeFromUrl`, writes `READY` (transcript + transcribedAt) or `FAILED` (transcriptError). **Never throws** — wraps everything in try/catch so `after()` callbacks don't crash. Skips assets that aren't `status = READY` (e.g. mid-upload). |
| [app/api/audio-assets/[audioAssetId]/complete/route.ts](app/api/audio-assets/[audioAssetId]/complete/route.ts) | Sets `export const maxDuration = 60` and calls `after(() => runTranscription(updated.id))` after the response is sent. Voice notes are capped at 2 min, Deepgram returns in ~5–15s, so this fits well inside the function's timeout. |
| [app/api/audio-assets/[audioAssetId]/transcript/route.ts](app/api/audio-assets/[audioAssetId]/transcript/route.ts) | `GET` for polling. Auth: any team member of the owning team — same access surface as audio playback. Returns `{ status, transcript, transcriptError }`. |
| [app/api/audio-assets/[audioAssetId]/transcript/retry/route.ts](app/api/audio-assets/[audioAssetId]/transcript/retry/route.ts) | `POST` for retry. Auth: **author-or-staff** — the original uploader OR ADMIN / INSTRUCTOR / ASSISTANT on the owning team. Resets row to `PENDING`, fires `after(() => runTranscription(...))` again. `maxDuration = 60`. The author allowance is what lets dancers retry their own voice-discussion transcripts; the staff allowance still covers cases where someone else needs to retry. |

### UI

[voice-note-transcript.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-transcript.tsx) is rendered into `VoiceNotePlayer`'s optional `transcriptSlot` prop, which keeps the player focused on playback/sync and lets the transcript layer be optional per call site.

Three visual states:
- **READY with text** — closed-by-default disclosure ("Show transcript ▾") that opens to a soft `--note-voice-accent`-tinted box with the text + an "Auto-generated transcript" footer line.
- **READY with empty text** — italicized "No speech detected in this voice note." (silent recording case — transcription succeeded but Deepgram returned no words).
- **PENDING / PROCESSING** — single muted line "Transcribing voice note…" with a `--note-voice-accent`-pulsing dot. Polls `GET /transcript` every 3s, capped at 60s. Past the cap, swaps to "Still working — refresh to check again."
- **FAILED** — muted "Transcript unavailable." When `canRetry` is true, surfaces a small "Try again" button that calls the retry endpoint via `useTransition` + sonner toast.

### Where it's wired

| Surface | `canRetry` | Notes |
|---|---|---|
| Workspace [notes-list-card.tsx](app/rehearsals/[rehearsalId]/workspace/notes-list-card.tsx) | When viewer is staff (`canAuthorNotes` from the page) | Shown inline under each voice note. |
| `/my-notes` [assigned-note-card.tsx](app/my-notes/assigned-note-card.tsx) | `false` | Recipients see the transcript but no retry — failed transcripts are rare and dancers ping their instructor. |
| `/notes-by-me` [authored-note-card.tsx](app/notes-by-me/authored-note-card.tsx) | `true` | Authors of voice notes are staff by definition (only staff roles can record). |
| Drill view ([drill-row.tsx](components/drill/drill-row.tsx)) | n/a (read-only) | When `transcriptStatus === READY` and the transcript is non-empty, the drill row renders the transcript text inline as the row body (replacing the "Voice note · 0:32" placeholder). When status isn't `READY` (or the transcript is empty), the row falls back to the placeholder. This is the highest-impact transcript surface — drill mode becomes useful for offline study and printing. |

The drill view's project-page sibling ([project-drill-section.tsx](app/projects/[projectId]/project-drill-section.tsx)) does the same fallback. The mapping function `readyTranscript(audioAsset)` in [app/projects/[projectId]/page.tsx](app/projects/[projectId]/page.tsx) is module-scoped (kept out of the page entry to avoid bumping its already-high cognitive complexity score).

### Realtime feel

Polling is the cheapest mechanism that works correctly:
- 3-second interval — Deepgram returns in ~5–15s for typical voice notes, so the user typically sees `READY` within 1–2 polls.
- 60-second ceiling — past that, the UI shows "Still working — refresh to check again" and stops polling. Avoids infinite spinners on a stuck row.
- Stops on terminal state (`READY` / `FAILED`) — both `useEffect` cleanup and `AbortController` are wired so unmounting the row (e.g. status filter change) doesn't leak.

### Backfill

[scripts/backfill-audio-transcripts.ts](scripts/backfill-audio-transcripts.ts) — `npm run db:backfill-transcripts` (uses `tsx`, same pattern as `db:backfill-onboarding`).

- Idempotent: only processes `AudioAsset` rows where `transcriptStatus = PENDING` and `status = READY`.
- Sequential (1 at a time) so we don't spike Deepgram quota.
- `DRY_RUN = true` flag at the top of the file — preview the work before running for real.
- `MAX_PROCESS = 100` cap — first run in prod is bounded; re-run to drain the rest.

### Privacy

The privacy page lists Deepgram in the vendor section and mentions transcripts under "What we store" — see [app/privacy/page.tsx](app/privacy/page.tsx). The wording deliberately *links* to Deepgram's privacy policy and terms instead of paraphrasing their commitments, so the public claim doesn't drift if Deepgram updates their policies.

## Rehearsal Workspace UI

The rehearsal page renders a context bar above the workspace and a sticky two-column workspace beneath it. All client state — playback URL, scrubbing, audience selection, edit-modal, voice flow — lives in [workspace/rehearsal-workspace.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-workspace.tsx). The other workspace components are presentational and receive props.

| File | Responsibility |
|---|---|
| [rehearsal-context-bar.tsx](app/rehearsals/[rehearsalId]/rehearsal-context-bar.tsx) | Page header: breadcrumb (team → project → rehearsal), title, role pill, meta row. Edge-to-edge background with `mx-auto max-w-7xl` content wrapper to align with the workspace below. Accepts an optional `actions` slot rendered on the right side of the title row — currently used by the "Drill from this rehearsal" button + the staff-only `RehearsalActionsMenu`. Both render side-by-side when both apply. |
| [drill-from-rehearsal-button.tsx](app/rehearsals/[rehearsalId]/drill-from-rehearsal-button.tsx) | Pill-shaped `<Link>` deep-linking to `/my-notes?view=drill&rehearsal=<id>`. Rendered in the context bar's `actions` slot **only when the viewer has ≥1 active assignment in this rehearsal** (count computed server-side from `projectActiveAssignments`). Avoids surfacing a button that lands on an empty state. Visible to both dancers and staff — anyone who has work to drill from the rehearsal sees it. |
| [rehearsal-actions-menu.tsx](app/rehearsals/[rehearsalId]/rehearsal-actions-menu.tsx) | Staff-only overflow `…` menu rendered into the context bar's `actions` slot when a video exists. Currently has a single **Replace video** item that opens a `<Dialog>` containing the upload form. Designed to extend with future rehearsal-level actions (delete, archive, share). |
| [workspace/rehearsal-workspace.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-workspace.tsx) | Orchestrator. Owns `videoRef`, `timelineRef`, scrubbing pointer state, playback-URL fetch, audience selection, edit-modal state, **lifted composer state** (mode, audienceOpen, snap), the **four sticky-video trigger states** (syncingAudioIds, isVideoPlaying, timestampTapPinned, composerExpanded — derived from snap), and the **`activeListTab` switcher state** (`"notes" \| "discussions"`). Builds the `markers[]` source for the timeline from whichever tab is active, with the matching `accentTone`. Picks which composer shell mounts (`AddNoteCard` / `AddDiscussionCard` on desktop, the shared `MobileComposerSheet` on mobile with body/peek slots built per active tab) via `useMediaQuery("(min-width: 1024px)")`. **Tab switches are blocked while recording** — the recorder unmount would lose the take; a sonner toast surfaces why the tap didn't take effect. Layout: `lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]` with sticky-top left rail and sticky-bottom composer in the right column on desktop. The `<ThreadExpansionProvider>` is **shared across both tabs** so open threads survive tab toggles (the mobile single-open rule applies across the union via `${type}:${id}` keys in the coordinator). |
| [workspace/rehearsal-video-card.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-video-card.tsx) | Dark "stage plate" wrapping `<video>` with no native `controls`, custom transport (play / pause + ±5s + mono time), and on-frame overlay pills (file watermark, time pill, center play button when paused). `isPlaying` is tracked locally via `onPlay`/`onPause`/`onEnded` events; an optional `onPlayingChange?: (isPlaying: boolean) => void` prop bubbles the same signal up to the workspace for the sticky-video logic. |
| [workspace/rehearsal-timeline-card.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-timeline-card.tsx) | Separate card with a 48-bucket density strip, scrubbable track, colored markers, playhead, and 5 evenly-spaced time ticks. Parameterized over a generic `markers: TimelineMarker[]` (shape `{ id, startTimestampMs, mediaType: "TEXT" \| "VOICE", summary }`) so notes and discussions both feed the same component. `accentTone: "notes" \| "discussions"` swaps the palette (notes use teal `--primary` for TEXT; discussions use indigo `--discussion-accent`); `countNoun: [singular, plural]` parameterizes the "N notes" / "N discussions" line. Density bars are absolutely positioned (not flex) so they share the same `0–100%` coordinate system as the markers. The workspace passes `noteMarkers` or `discussionMarkers` based on `activeListTab`; un-anchored discussions are excluded from the marker list (they appear in the row list but not on the timeline). |
| [workspace/notes-summary.tsx](app/rehearsals/[rehearsalId]/workspace/notes-summary.tsx) | "Progress spine" — aggregates `NoteAssignment` statuses across all notes (not per-note) into a four-segment stacked bar. Returns `null` when there are no assignments. |
| [workspace/notes-list-card.tsx](app/rehearsals/[rehearsalId]/workspace/notes-list-card.tsx) | Filter pill row (`ALL / OPEN / IN_PROGRESS / ADDRESSED / RESOLVED / UNASSIGNED / VOICE / MINE`) + assignee dropdown + tag dropdown (only shown when at least one tagged note exists) + thread of `NoteRow`s. `NoteRow` shows a `TagChip` next to the author name when the note has a tag, and a compact `RepeatingChip` next to each `StatusChip` for assignments that are part of a repeating cluster. Pills show precomputed counts; status filters match notes that have *any* assignment with the given status. |
| [workspace/composer-body.tsx](app/rehearsals/[rehearsalId]/workspace/composer-body.tsx) | **Shared composer body** — the sub-bar (mode tabs, audience trigger, `TagPicker`, timestamp pill) plus the body that morphs between the textarea/Post button (text mode), `VoiceNoteRecorder` (voice mode), and the **inline audience panel** (mobile only — replaces the textarea/recorder body when `audienceOpen && !isDesktop`). Detects viewport via `useMediaQuery`: on desktop the audience trigger wraps in a Radix Popover (overlay); on mobile it's a plain toggle button that drives the inline panel via the `audienceOpen` state already lifted to the workspace. Body content is extracted into a `body` variable with explicit if/else branches (keeps cognitive complexity under the lint cap). Accepts two mobile-only props from the workspace: `writingMode` (bumps the textarea to `min-h-[180px]` / `rows={6}`) and `onTextareaFocusChange` (fires on the textarea's focus/blur so the workspace can promote the sheet to the writing snap). No outer `Card` wrapper. |
| [workspace/add-note-card.tsx](app/rehearsals/[rehearsalId]/workspace/add-note-card.tsx) | Thin desktop shell — `<Card>` wrapping `<ComposerBody />`. Mounted at `lg:+` only. |
| [workspace/composer-peek-row.tsx](app/rehearsals/[rehearsalId]/workspace/composer-peek-row.tsx) | The 80-pixel peek row inside `MobileComposerSheet`. Drag handle (rendered by the sheet) above; this component is the row underneath. Layout: compact mode toggle (icon-only Text/Voice, `h-9 w-9` for thumb tappability) + tap-to-recapture timestamp pill + **optional** audience chip (note-mode passes `audienceSummary`; discussion-mode passes `null` and the chip is omitted) + expand label (default `Tap to write/record…`; discussion-mode passes `expandLabelOverride` for `Tap to start a discussion…`). Each interactive element is its own `<button>` with an `aria-label` so SR users don't see one giant button. |
| [workspace/mobile-composer-sheet.tsx](app/rehearsals/[rehearsalId]/workspace/mobile-composer-sheet.tsx) | Vaul-based bottom sheet (mounted at `<lg`). **Generic shell** parameterized over `body: ReactNode` + `peek: ReactNode` slots so the same drawer hosts either the note composer or the discussion composer. The caller passes `draftText` + `isPending` so the auto-collapse-after-text-submit logic stays generic (true→false transition with empty text → snap to peek). Three snap points: `[COMPOSER_PEEK_SNAP, COMPOSER_EXPANDED_SNAP, COMPOSER_WRITING_SNAP]` = `["80px", "220px", "340px"]`. `modal={false}` keeps the page interactive behind the sheet; `dismissible={false}` so peek is the floor; `repositionInputs={false}` (explicit — Vaul's default of true caused real-device glitches, see below). All snap/mode/recording state is lifted to `RehearsalWorkspace`. Bounces null snap-changes back to peek (Vaul's "user dragged to dismiss" signal). When `isRecording` is true, snap-changes bounce back to the expanded snap. Also runs **capture-phase `focusin` + `focusout` listeners** that `stopImmediatePropagation()` when focus is moving outside `[data-vaul-drawer]` — escape hatch for Radix `DialogPrimitive.Root`'s focus trap. Exports `COMPOSER_PEEK_SNAP`, `COMPOSER_EXPANDED_SNAP`, `COMPOSER_WRITING_SNAP`, and the `ComposerSnap` type. See "Mobile composer sheet" below. |
| [workspace/voice-note-recorder.tsx](app/rehearsals/[rehearsalId]/workspace/voice-note-recorder.tsx) | Records audio + runs steps 1-3 of the voice flow (upload-url → PUT to GCS → complete), then hands off to the parent via `onAudioReady({ audioAssetId, durationMs, startTimestampMs, endTimestampMs })` for the entity-creation request (step 4: POST to `/notes` or `/discussions`). Threading `uploadPurpose: "note" \| "discussion"` adjusts the upload-url query param so the route gates appropriately (notes: staff-only; discussions: any team member). `saveButtonLabel` defaults to `Save voice note`; the discussion composer passes `Save voice discussion`. `onRecordingStateChange` fires `true` when the countdown begins, `false` on cancel / stop / error / unmount — used by `MobileComposerSheet` to lock dismissal during countdown/recording. Throwing inside `onAudioReady` keeps the recorder in preview state with the blob retained, so the parent's POST failure doesn't lose the take. |
| [workspace/audience-picker.tsx](app/rehearsals/[rehearsalId]/workspace/audience-picker.tsx) | Combobox-style picker (full-cast quick action, groups, individuals). Now rendered inside the composer's audience popover and inside `EditNoteSheet`. |
| [workspace/tag-picker.tsx](app/rehearsals/[rehearsalId]/workspace/tag-picker.tsx) | Single-select Radix Popover for the optional `NoteTag` enum. See "Note Tags" above. |
| [workspace/status-chip.tsx](app/rehearsals/[rehearsalId]/workspace/status-chip.tsx) | Per-recipient status chip (`name + 7px dot + status label`). Capped at `max-w-full` with `min-w-0 truncate` on the label and `shrink-0` on the dot/status word, so long names or emails truncate with `…` instead of overflowing the parent card; full label is exposed via `title=` for hover/long-press. Exports `StatusDot` for reuse (used by `notes-summary.tsx`). |
| [workspace/notes-discussions-switcher.tsx](app/rehearsals/[rehearsalId]/workspace/notes-discussions-switcher.tsx) | Two-button segmented switcher above the right column. Mirrors the `Inbox / Drill view` pattern from `/my-notes`. Active palette differs by tab (Notes → teal `--primary`, Discussions → indigo `--discussion-accent`) so the switcher previews what the user is about to land on. Counts are shown inline. |
| [workspace/discussions-summary.tsx](app/rehearsals/[rehearsalId]/workspace/discussions-summary.tsx) | Light header above the discussions list — count + "Started by N people" + voice tally. Returns `null` when there are no discussions (the empty state lives inside the list card). No progress spine equivalent because discussions have no status pipeline. |
| [workspace/discussion-row.tsx](app/rehearsals/[rehearsalId]/workspace/discussion-row.tsx) | Mirror of `NoteRow` for discussions. Left rail: `NoteTimestampPill` with `tone="discussion"` when anchored, otherwise a dashed "No anchor" pill + media-type label. Body: `AvatarInitials` + author name + author-only `…` menu with Delete (Edit deferred). Voice rows reuse `VoiceNotePlayer` + `VoiceNoteTranscript` (`canRetry` from the workspace's `canAuthorNotes`). Un-anchored discussions surface a "Project-wide · no video anchor" affordance. Each row carries a `<ThreadAttachment target={{ type: "discussion", id }} ... showStartHint />`. |
| [workspace/discussions-list-card.tsx](app/rehearsals/[rehearsalId]/workspace/discussions-list-card.tsx) | Wraps the list in a Card with a filter pill row (`ALL / UNANCHORED / VOICE / MINE`). Counts are precomputed; pills use `--discussion-accent` when active. Empty state distinguishes "no discussions yet" (with explanatory copy) vs "no discussions match this filter". |
| [workspace/discussion-composer.tsx](app/rehearsals/[rehearsalId]/workspace/discussion-composer.tsx) | Lighter than `composer-body` — no audience picker (discussions are team-wide), no tag picker (deferred to v1.5). Sub-bar: mode tabs (text/voice — voice is disabled with a tooltip when no video is ready) + anchor toggle (Pin / PinOff icon, disabled in voice mode since voice is always anchored) + timestamp pill (only when anchored). Voice mode embeds `<VoiceNoteRecorder uploadPurpose="discussion" saveButtonLabel="Save voice discussion" />` with `onAudioReady` POSTing to `/api/projects/[projectId]/discussions`. Tab-specific state (text, isAnchored) is lifted to the workspace; mode + snap + recording are shared with notes (only one composer surface is active at a time). |
| [workspace/add-discussion-card.tsx](app/rehearsals/[rehearsalId]/workspace/add-discussion-card.tsx) | Thin desktop shell — `<Card>` wrapping `<DiscussionComposer />`. Mirrors `AddNoteCard`. Mounted at `lg:+` only; mobile uses the shared `MobileComposerSheet` with `<DiscussionComposer />` slotted into the body. |

### Mobile composer sheet

Below `lg:` (1024px) the composer wraps in a [Vaul](https://vaul.emilkowal.ski/) bottom sheet ([components/ui/drawer.tsx](components/ui/drawer.tsx) is the shadcn install). Three pixel-based snap points: **peek (80px)** always visible above the system nav, **expanded (220px)** for general composing, and **writing (340px)** auto-activated when the user focuses the text-mode textarea or opens the inline audience picker.

**Three snaps, content-sized:** every snap is sized to the worst-case content it needs to hold rather than to a viewport fraction (which would leave dead space on tall phones or clip on small ones).
- `COMPOSER_PEEK_SNAP = "80px"` — drag handle + a single 36px peek row of taps (mode toggle / timestamp / audience / "Tap to write…" chevron).
- `COMPOSER_EXPANDED_SNAP = "220px"` — sub-bar (~84px wrapped) + voice preview body (~150px) = the default composing height. Sufficient for voice mode and idle text mode.
- `COMPOSER_WRITING_SNAP = "340px"` — sub-bar + 180px textarea + Send row + paddings. Auto-promoted when the user actually starts typing in text mode, so the textarea has a comfortable height *and* the bottom of the sheet still sits above the on-screen keyboard with no dead zone between them.

**Writing mode** (`composerWritingMode = composerSnap === COMPOSER_WRITING_SNAP`) is the load-bearing concept for keyboard-friendly typing on phones. When active, the workspace **hides the video + timeline on `max-lg:`** (via `max-lg:hidden` keyed off the flag) to reclaim vertical space — the timestamp pill in the composer header is the load-bearing reference at this point, not the live video frame. The textarea also bumps to `min-h-[180px]` / `rows={6}`. Voice mode never enters writing mode (no textarea, no focus event).

**Writing-mode triggers** (any of these promotes `composerSnap` to `COMPOSER_WRITING_SNAP`):
1. Textarea focus (text mode only) — `handleTextareaFocusChange` in the workspace. Does **not** auto-demote on blur — the user may be tapping the audience picker or tag picker between keystrokes, and snap-shrinking on every blur would feel jumpy. Send (auto-collapse to peek) and explicit drag-down are the exits.
2. Audience picker open — `handleAudienceOpenChange` in the workspace. On mobile the audience picker renders inline in the sheet body (replacing the textarea/recorder) so the search input gets a comfortable height. See "Inline audience picker" below.

**Writing-mode demotions:**
- Mode toggle to voice — `handleComposerModeChange` drops back to `COMPOSER_EXPANDED_SNAP` (voice doesn't need 340px), and also closes `audienceOpen` so the body immediately shows the new mode's surface instead of a stale picker.
- Send / save (existing auto-collapse to peek).

**Inline audience picker (mobile):** [composer-body.tsx](app/rehearsals/[rehearsalId]/workspace/composer-body.tsx) detects viewport via `useMediaQuery`. On desktop the audience trigger wraps in a Radix `Popover` (overlay). On mobile the trigger is a plain toggle button, and when `audienceOpen` is true the picker renders as the body content (replacing the textarea/recorder) with a "Pick audience" header + "Done" button. The selection toggle callbacks are the same as the popover version, so state mutates inline; "Done" calls `onAudienceOpenChange(false)` and the user returns to whichever mode they were in. This eliminates the popover-over-sheet-over-keyboard stacking problem that the desktop popover would create on mobile — the search input is in the sheet directly, the keyboard opens against a 340px surface, no collision math.

**Vaul focus-trap escape:** Vaul wraps Radix `DialogPrimitive`, but does **not** pass `modal={false}` through to `DialogPrimitive.Root` — so internally Radix runs in modal mode and engages `FocusScope` to trap focus inside the drawer. `FocusScope` registers `focusin` AND `focusout` listeners on the document; the load-bearing one is `focusout`, which synchronously refocuses the last drawer element when `relatedTarget` is outside the container. Without an escape, comment-composer textareas outside the sheet are impossible to focus — the user's tap fires `focusout` on the sheet, Radix snaps focus back, and the tap target never receives it. The fix lives in `MobileComposerSheet`'s `useEffect`: **capture-phase listeners for both `focusin` and `focusout`** that call `e.stopImmediatePropagation()` when the focus destination is outside `[data-vaul-drawer]` (`focusin` checks `e.target`; `focusout` checks `e.relatedTarget`). Capture-phase fires before Radix's bubble-phase listeners and `stopImmediatePropagation` prevents them from firing at all, so the trap never engages. Focus stays where the browser put it.

**Mobile keyboard handling:** `repositionInputs={false}` is set explicitly (Vaul's default is `true`). An earlier `repositionInputs={true}` + 55vh combo had two real-device glitches: (1) the auto-lift sometimes oversized the drawer to cover the viewport (whiting out the page underneath), and (2) on keyboard dismiss the drawer stayed translated up where the keyboard had been. With `repositionInputs={false}` plus the new 340px writing snap (which already accounts for keyboard real estate), Vaul isn't trying to lift anything — the page's layout viewport just resizes around the keyboard naturally (Android default; iOS overlays the keyboard on top, but the 340px-anchored-bottom sheet stays usable). The `Textarea` primitive uses `text-base` (16px) on mobile so iOS won't auto-zoom on focus.

**State ownership:** `mode`, `audienceOpen`, `snap`, and the textarea-focus signal are all lifted to `RehearsalWorkspace`. The sheet is **fully controlled**. The workspace derives `composerExpanded = snap !== COMPOSER_PEEK_SNAP` for the sticky-video logic and `composerWritingMode = snap === COMPOSER_WRITING_SNAP` for the video/timeline hide logic — no callback round-trips needed.

**Single-mount rule:** `useMediaQuery("(min-width: 1024px)")` (in [lib/hooks/use-media-query.ts](lib/hooks/use-media-query.ts)) returns `null` during SSR/pre-hydration, then resolves to true/false. The workspace renders **exactly one** of `<AddNoteCard>` (desktop) or `<MobileComposerSheet>` (mobile), never both — double-mounting `VoiceNoteRecorder` would double-request the mic. Both shells render nothing until the hook resolves; the composer is below-the-fold so the brief absence is invisible.

**Tap interactions from peek:**
- **Timestamp pill** → `onCapture()` (recapture playhead), stays in peek.
- **Audience chip** → `onAudienceOpenChange(true)`. The workspace's `handleAudienceOpenChange` wrapper handles the snap promotion to writing — the sheet doesn't double-handle it.
- **Mode toggle** → `onModeChange(next)`, doesn't expand. Suppressed when `isRecording` is true (would unmount the recorder mid-take).
- **"Tap to write…" / chevron** → expands to `COMPOSER_EXPANDED_SNAP`.

**Recording lock:** `VoiceNoteRecorder.onRecordingStateChange` flows up to `setIsRecording`. While true:
- Sheet's `handleSnapChange` bounces any non-`COMPOSER_EXPANDED_SNAP` requests back, including null.
- `handleModeChange` early-returns.
- The recorder also fires `false` defensively from its unmount cleanup so a stale lock can't strand the sheet at the expanded snap.

**Why `dismissible={false}`:** with `dismissible={true}`, dragging below the smallest snap fires `setActiveSnapPoint(null)` and Vaul translates the drawer off-screen entirely — even with `open` still true. Setting `dismissible={false}` makes peek the floor; users collapse via drag-down or outside-tap (when expanded), not by dismissing.

**Why `modal={false}`:** the page underneath stays interactive while the sheet is in peek (and during expanded states). Users can scroll the notes thread, tap notes, scrub the timeline. This is the iOS Maps / Linear pattern, not a focus-trapped Dialog. (Vaul's `modal={false}` only governs Vaul's own outside-interaction handlers, not the inner Radix Dialog — see "Vaul focus-trap escape" above for the additional fix that's needed.)

**Why `h-full` on the drawer content:** Vaul's snap math expects the content element to fill its parent (the portal target / viewport). Constraining the height (e.g. `h-[340px]` to "match the largest snap") breaks Vaul's positioning math and the drawer ends up below the viewport. Over-drag past the topmost snap during the gesture is bounded by Vaul's release-snap (returns to nearest snap on release) plus the `dismissible={false}` floor at peek — not by capping the height.

**Trade-off accepted:** drag-up past the writing snap shows elastic over-drag during the gesture; Vaul snaps back to the 340px snap on release. Could be tightened with custom drag interception but it's a recognized iOS bottom-sheet pattern, not a bug.

### Contextual sticky video (mobile)

The video card on mobile gets `max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:shadow-md max-lg:transition-shadow` applied conditionally based on a single `isVideoPinned` boolean computed in `RehearsalWorkspace`:

```ts
const isVideoPinned =
  syncingAudioIds.size > 0 ||  // 1. voice sync playback (existing)
  composerExpanded ||           // 2. composer sheet expanded
  isVideoPlaying ||             // 3. video actively playing
  timestampTapPinned            // 4. user tapped a timestamp pill in last ~10s
```

Each trigger is a separate piece of state with its own update path:

1. **Voice sync** (`syncingAudioIds: Set<string>`) — `VoiceNotePlayer.onSyncPlaybackChange` adds/removes asset IDs as sync mode engages/disengages. Set (not boolean) handles overlapping playback.
2. **Composer expanded** — derived from the lifted `composerSnap` state (`composerSnap !== COMPOSER_PEEK_SNAP`).
3. **Video playing** (`isVideoPlaying: boolean`) — `RehearsalVideoCard.onPlayingChange` fires from existing `onPlay`/`onPause`/`onEnded` handlers.
4. **Timestamp tap** (`timestampTapPinned: boolean`) — set inside `jumpToTimestamp` when the user taps a `NoteTimestampPill`. A `useRef`-tracked timeout (cleanup `useEffect` on unmount) clears it after 10 seconds. Re-tapping resets the timer (clear-then-set) instead of accumulating.

**Why per-trigger state** (instead of one shared "should pin?" function): each trigger has a different lifecycle — sync is event-driven, expanded is derived from sheet snap, playing is event-driven, tap is timeout-bounded. Combining them into one piece of state would couple their update paths. The OR composition stays simple at the use site.

**Why mobile only:** on desktop the video lives in a `lg:sticky lg:top-4` column already (column-scoped sticky). The trigger logic only matters at `<lg` where the video is in the mobile flow. The CSS `max-lg:sticky` takes care of the gating.

### Design tokens

The status palette, voice-note accent, and avatar tones are CSS variables in [app/globals.css](app/globals.css), defined in both `:root` and `.dark`:

- `--status-open-{bg,fg,border}`, `--status-progress-*`, `--status-addressed-*`, `--status-resolved-*` — derived from the existing teal primary so nothing reads as alarming.
- `--note-voice-{accent,bg,border}` — coral, used for voice-note accent stripes, waveform bars, and recorder/preview chrome.
- `--avatar-tone-{neutral,teal,coral,olive,plum}-{bg,fg}` — initials-avatar palette. Light mode is pale-bg + saturated-fg; dark mode is deep-tinted-bg + light-fg. `AvatarInitials` picks a tone deterministically by hashing `toneSeed` (typically a stable `userId`) so the same person reads with the same hue across pages.
- `--repeating-{bg,fg,border}` — plum/violet (hue ~285), used by `RepeatingChip` and the project-page `RepeatingClustersCard`. Sits in a hue family separate from status/voice/avatar tokens so the "repeating" signal reads as a flag, not a state.

Use `var(--*)` directly (or `color-mix(in oklch, var(--*) X%, transparent)` for translucent tints) rather than hard-coding colors. New status states or avatar tones should be added by extending these tokens, not by introducing per-component palettes.

`ThemeProvider` is mounted in [app/layout.tsx](app/layout.tsx) and a three-state toggle lives in the global header. See "Theming & dark mode" above for the full setup, including the SSR-safe mount pattern and the keydown-handler hardening against synthetic events.

## My Notes UI

`/my-notes` is the recipient inbox — optimized for clarity, ownership, and quick status updates. The user sees what they owe and can change a note's status with one click on an inline segmented control.

| File | Responsibility |
|---|---|
| [app/my-notes/page.tsx](app/my-notes/page.tsx) | Server entry. Fetches via `getAssignedNotesForUser`, maps Prisma rows to flat `AssignedNoteRow[]` (no bucketing — the client owns that), renders `<SectionTabNav active="my-notes" />` + slim title bar + `<MyNotesList rows={rows} />`. |
| [app/my-notes/my-notes-list.tsx](app/my-notes/my-notes-list.tsx) | Client orchestrator. Owns `MyNotesFilter` (authorId / projectId / noteType / tag — all single-select toggles, AND-combined), the per-status expanded state, and the **Inbox / Drill view** toggle (URL-synced via `?view=drill`). Computes filter options from the full row set, applies the filter, picks the hero (**oldest unresolved**, sorted `createdAt` ASC across `OPEN` + `IN_PROGRESS`), buckets the rest by status, sorts each bucket newest-first. Inbox layout: `lg:grid-cols-[240px_minmax(0,1fr)]` with sticky rail + queue. Drill mode renders [DrillView](app/my-notes/drill-view.tsx) instead. See "Drill surfaces" below for the auto-default-to-busiest-project rule. |
| [app/my-notes/queue-summary.tsx](app/my-notes/queue-summary.tsx) | Sticky left rail. "On your plate" big number + status breakdown (filtered counts) + From / Project / Tag / Type filter sections. Below `lg`, From / Project / Tag / Type collapse behind a "Filters" disclosure with an active-filter count badge — initial open state is derived from whether any filter is currently active. The disclosure is a single `<div>` with `cn(open ? "flex" : "hidden", "lg:flex")` so `lg+` always shows everything regardless of mobile state. The Tag section only renders when at least one tagged note exists in the row set. |
| [app/my-notes/assigned-note-card.tsx](app/my-notes/assigned-note-card.tsx) | Per-row card with optional `hero` variant (used for "Up next"). Hierarchy: `NoteRehearsalLink` + `NoteTimestampPill` + optional `TagChip` + optional `RepeatingChip` + relative age → author avatar + name + audience chips (or "You" pill when the only target is the implicit USER) → body (text or `VoiceNotePlayer` standalone) → `StatusSegmented` + "Open in rehearsal" anchor. The author's USER target is filtered out of audience chips because the note is in their inbox precisely *because* they were targeted. |
| [app/my-notes/drill-view.tsx](app/my-notes/drill-view.tsx) | Read-only tag-grouped drill mode. See "Drill surfaces" below. |
| [app/my-notes/status-segmented.tsx](app/my-notes/status-segmented.tsx) | Inline 4-button radiogroup that's the primary interaction on every card. Active button picks up the per-status accent color from CSS tokens. Calls `updateNoteAssignmentStatus` via `useTransition` for an optimistic feel. |
| [app/my-notes/note-status-actions.ts](app/my-notes/note-status-actions.ts) | `updateNoteAssignmentStatus` server action — unchanged across the redesign; status mutation flows through the same pipeline as before. |
| [app/my-notes/types.ts](app/my-notes/types.ts) | `AssignedNoteRow` (extended with `repeating: RepeatingMarker \| null` and `note.tag: NoteTag \| null`), `MyNotesFilter` (extended with `tag`), `EMPTY_FILTER`, `AuthorOption`, `ProjectOption`, `TagOption`, `TypeCounts`, `DEFAULT_EXPANDED_STATUSES`, `RepeatingMarker`. Re-exports `NOTE_STATUSES` / `NOTE_STATUS_LABELS` from `@/lib/notes/statuses`. |

**Filter rule**: AND across categories. Each category is a single-select toggle (click again to clear). Rail counts: status breakdown reflects the **filtered** queue; From / Project / Tag / Type option counts are the **unfiltered** totals (so they stay stable as the user clicks).

**Hero rule**: oldest unresolved (any `OPEN` or `IN_PROGRESS`) row in the filtered set. If the filter excludes all unresolved rows, no hero is rendered — only the status groups appear.

**Server-side repeating computation**: [page.tsx](app/my-notes/page.tsx) calls `getActiveAssignmentsForProjects` once per request scoped to projects this user has notes in, then runs `detectRepeatingClusters` filtered to `dbUser.id` so only this user's clusters surface on `/my-notes`. The resulting `Map<assignmentId, RepeatingMarker>` is threaded into each `AssignedNoteRow.repeating` for O(1) chip rendering.

## Notes By Me UI

`/notes-by-me` is the author follow-through dashboard — optimized for progress visibility and triage. Per-recipient state is the visual focus, not the body text.

| File | Responsibility |
|---|---|
| [app/notes-by-me/page.tsx](app/notes-by-me/page.tsx) | Server entry. Fetches via `getNotesByAuthor`, maps each note to `AuthoredNoteRow` with two derived fields computed once per request: `assignmentCounts` (per-status totals) and `stalled` (via `isNoteStalled` against a single `now` captured at the top of the handler). Renders `<SectionTabNav active="notes-by-me" />` + slim title bar + `<NotesByMeList notes={rows} />`. |
| [app/notes-by-me/notes-by-me-list.tsx](app/notes-by-me/notes-by-me-list.tsx) | Client orchestrator. Owns `AuthoredNoteFilter` (`OUTSTANDING / STALLED / COMPLETE / UNASSIGNED / ALL`, default `OUTSTANDING`) and `AuthoredNoteSort` (`STALLED_FIRST / RECENT / OLDEST`, default `STALLED_FIRST`). Also owns the existing `EditNoteSheet` flow: opens the sheet, lazy-fetches `/api/rehearsals/[id]/audience`, submits `PATCH /api/notes/[noteId]`, and `router.refresh()` on success. Delete flow goes through `DELETE /api/notes/[noteId]` and refreshes. |
| [app/notes-by-me/author-summary-strip.tsx](app/notes-by-me/author-summary-strip.tsx) | 3-column dashboard at the top: follow-through % + aggregate `<NoteProgressBar>` + visible-segment legend; stalled card (tinted `--status-progress-*` when count > 0) with optional `onJumpToStalled` callback (wired to set `filter = "STALLED"`); unassigned card. |
| [app/notes-by-me/filter-sort-bar.tsx](app/notes-by-me/filter-sort-bar.tsx) | Filter pills (counts shown inside each pill; the STALLED pill takes the in-progress tint when count > 0 and inactive) + sort segmented (`STALLED_FIRST / RECENT / OLDEST`). |
| [app/notes-by-me/authored-note-card.tsx](app/notes-by-me/authored-note-card.tsx) | Per-note triage row. Top row: rehearsal breadcrumb + accent timestamp pill + voice/text marker + Stalled chip + relative age + `NoteActionsMenu`. Body: `Sent to` + audience chips (USER targets filtered out) + clamped 2-line text or `VoiceNotePlayer` standalone. Progress block: `n/N addressed` + `<NoteProgressBar>` + Complete badge + `<RecipientPipRow>`. Unassigned notes show a dashed banner with an inline **Assign** button that opens `EditNoteSheet`. |
| [app/notes-by-me/recipient-pip-row.tsx](app/notes-by-me/recipient-pip-row.tsx) | Per-assignment chip: `AvatarInitials` (toneSeed = `user.id`) + name + `StatusDot` + status word. When the parent note is stalled, OPEN pips pick up the in-progress tint to flag who is holding things up. |
| [app/notes-by-me/types.ts](app/notes-by-me/types.ts) | `AuthoredNoteRow` (extends with `assignmentCounts`, `stalled`, `tag`, `hasRepeating`), `AuthoredAssignmentCounts`, `AuthoredNoteFilter`, `AuthoredNoteSort`, `AuthoredNoteAssignment` (now carries `repeating: AuthoredRepeatingMarker | null`), `AuthoredNoteTarget`, `AuthoredNoteAudio`, `AuthoredRepeatingMarker`. |

**Stalled derivation**: a note is stalled when `now - createdAt > 3 days` AND at least one assignment is `OPEN` or `IN_PROGRESS`. Threshold is `STALLED_THRESHOLD_DAYS` in [lib/notes/stalled.ts](lib/notes/stalled.ts). Computed server-side once per request so client filtering/sorting is just a boolean check.

**Filter relationships**: STALLED is a strict subset of OUTSTANDING (a stalled note necessarily has at least one active assignment). `OUTSTANDING + COMPLETE + UNASSIGNED === ALL`.

**Tag + repeating integration**: `AuthoredNoteCard` shows the tag chip in the top meta row when present. `RecipientPipRow` shows a small `Repeat` icon decoration next to the status dot per pip when that assignment is in a repeating cluster (uses `--repeating-fg` for the icon color). `FilterSortBar` adds a tag-filter row below the status pills when at least one tagged note exists; ANDs with the status filter. `AuthorSummaryStrip` adds a fourth tile "Repeating: N dancers" when N > 0 (the grid switches from 3-col to 4-col only in that case).

## Drill surfaces

Drill mode is **read-only** — all updates still happen through the normal note flows (create, edit, status change). No dedicated drill route in v1; capability ships in two places.

### Priority sort within tag buckets

Within every tag section on every drill surface, rows are ordered by a derived priority via [lib/notes/drill-sort.ts](lib/notes/drill-sort.ts). Default order:

1. Rows in a repeating cluster (their tag's cluster) first
2. Then by oldest unresolved (`createdAt` asc)
3. Then by newest rehearsal (`rehearsalDate` desc)
4. Then by `id` for full determinism (matters for print-output reproducibility)

The helper is parametric over row type via an accessor (`sortByDrillPriority(rows, toKey)`) so `/my-notes` can sort `AssignedNoteRow[]` (nested) and the project page can sort `DrillItem[]` (flat) without sharing a shape.

### `/my-notes` Drill view

A view-mode toggle at the top of `/my-notes` flips between **Inbox** (default) and **Drill view**. Persisted in the URL as `?view=drill` so it's bookmarkable but not stored server-side.

| File | Responsibility |
|---|---|
| [app/my-notes/drill-view.tsx](app/my-notes/drill-view.tsx) | Tag-grouped checklist. Top "Recurring drills" section surfaces clusters as `ExpandableRepeatingChip`s; tag sections render in fixed order (TIMING → SPACING → ENERGY → MUSICALITY → FORMATION → TECHNIQUE → Other). Each row is read-only: optional project chip (when 2+ projects active) + rehearsal title link + timestamp + clamped body or voice-note placeholder + status dot. Rows are sorted by `sortByDrillPriority` within each bucket. "Print" button calls `window.print()`. Optional `singleProjectHeader` / `singleRehearsalHeader` props render a "Showing N notes from X · See all …" banner when filtered. Wraps its body in `<RepeatingClusterExpansionProvider>` so the chips in the header AND the chips inside each `DrillTagSection` share one coordinator. Empty-state branches (`DrillEmptyState` + `EmptyStateMessage`) live alongside as sibling functions — three cases: rehearsal-scoped + has-elsewhere, project-scoped + has-elsewhere, genuinely caught up. |
| [app/my-notes/my-notes-list.tsx](app/my-notes/my-notes-list.tsx) | Owns the toggle. Computes `activeProjects` (sorted by openCount desc) once. Lazy-initializes the filter — `?rehearsal=<id>` wins (skip project auto-default entirely), otherwise the busiest-active-project auto-default fires on entering drill mode (deep-link case via `useState` initializer; click-toggle case in `setViewMode`). Threads `showProjectInRows`, `singleProjectHeader`, `singleRehearsalHeader`, and `repeatingClusterDetails` props to `DrillView`. Tour gating uses `viewMode === "inbox"` so the tip sequence skips while in drill mode (anchors are absent). |
| [app/my-notes/page.tsx](app/my-notes/page.tsx) | Reads `?rehearsal=<id>` from `searchParams` (typed as the Next.js 16 promise shape), normalizes to `string \| null`, passes as `initialRehearsalId`. Builds `RepeatingClusterDetail[]` for this viewer inline from `projectActive` + `myProjectClusters` — voice transcripts only included when `transcriptStatus === "READY"`. Cluster key on this surface is the tag alone (one viewer per cluster). |

**Auto-default rule**: when the user has open + in-progress notes in **2+ projects**, the project filter pre-applies to the project with the most open notes. The `SingleProjectHeader` button "See all projects" clears just the project filter. If the user clears the filter and re-enters drill mode, they get auto-defaulted again — accepted trade-off vs. tracking explicit-clear state through React Compiler's "no setState in effect" rule.

**Rehearsal-scoped drill entry (`?rehearsal=<id>`)**: clicking "Drill from this rehearsal" on a workspace deep-links to `/my-notes?view=drill&rehearsal=<id>`, which initializes the filter with `rehearsalId` set and **skips the project auto-default** (rehearsal is the narrower, more-specific intent). The `SingleRehearsalHeader` companion banner appears above the bucket list with a "See all rehearsals" link that both clears local state AND drops `?rehearsal` from the URL via `router.replace`. The filter survives toggling Inbox ↔ Drill (the URL param is preserved); only the explicit clear removes it. Empty-state copy distinguishes "no drills from this rehearsal — but you have N elsewhere" from the project-scoped or globally-caught-up cases.

**Project chip on rows**: each drill row shows its project title as a small muted chip when the user has notes in 2+ projects (so they always know what show they're drilling). Hidden when there's no ambiguity.

### Project-page drill surfaces

`/projects/[projectId]` adds two sibling cards between the meta band and `RehearsalsSection`, both backed by the same `getActiveAssignmentsForProjects` query. **Both are staff-only** — gated behind `isStaff = role === "ADMIN" || role === "INSTRUCTOR" || role === "ASSISTANT"`. Dancers don't see the project drill board or the repeating-clusters card; their personal drill view at `/my-notes?view=drill` is the dancer-side alternative, scoped to their own notes.

The "Manage cast" button in the project meta band's `actions` slot is also staff-only — for dancers, it would link to a team page they can only read, so it's hidden rather than rendered as a misleading CTA.

| File | Responsibility |
|---|---|
| [app/projects/[projectId]/repeating-clusters-card.tsx](app/projects/[projectId]/repeating-clusters-card.tsx) | Compact summary card, **client component** since rows are now expandable. One row per cluster: avatar + dancer name + tag chip + "N unresolved" button. When a matching `RepeatingClusterDetail` is in the lookup (always true in practice — both derive from the same `projectClusters` set), the row's "N unresolved" pill becomes interactive (`aria-expanded`, `ChevronDown`); clicking expands the `RepeatingClusterDetails` panel inline below the row. Mounts its own `<RepeatingClusterExpansionProvider>`. Hides when `clusters.length === 0`. Uses the `--repeating-*` tokens for surface tinting. |
| [app/projects/[projectId]/project-drill-section.tsx](app/projects/[projectId]/project-drill-section.tsx) | Per-dancer collapsible drill board with a **`?groupBy=tag` toggle** at the top of the section (URL-persisted, defaults to `dancer`). Each grouping mode owns its own expansion state (`dancerExpanded` keyed by `userId`, `tagExpanded` keyed by tag name) so "Expand all" behaves correctly per mode. Mounts one shared `<RepeatingClusterExpansionProvider>` at the section root — repeating-chip expansion state survives mode toggles via the shared `${userId}-${tag}` key. See "Grouping modes" below. Hides when no active assignments exist in the project. |

#### Grouping modes (`/projects/[projectId]` drill board)

| Mode | URL | Layout |
|---|---|---|
| **By dancer** (default) | no param | `DancerGroupedView` — one collapsible card per dancer → tag sections inside (existing layout). Answers "is Iris OK?" |
| **By tag** | `?groupBy=tag` | `TagGroupedView` — one collapsible card per tag → `DancerInTagSection` blocks inside (avatar + name + count + optional `ExpandableRepeatingChip` + their priority-sorted drill rows). Answers "who needs to be in the timing sectional?" |

Same data drives both — the transpose lives in `buildTagGroups(recipients)`, a pure helper that walks the per-recipient buckets and groups by tag. Within each tag card, dancers sort: (1) repeating-on-this-tag first, (2) item count desc, (3) name asc. Tag groups themselves sort by canonical `NOTE_TAGS` order, untagged ("Other") last.

The toggle is a small segmented control next to the existing "Expand all / Collapse all" button. Default copy under the section header adapts to the active mode ("…grouped by dancer and tag" vs "…grouped by tag — useful for planning sectionals").

### Print stylesheet

`@media print` block in [app/globals.css](app/globals.css), **scoped to `body[data-print-target="drill"]`**. The `DrillView` component sets `document.body.dataset.printTarget = "drill"` in a `useEffect` while mounted and clears it on unmount, so accidentally printing any other page (Cmd+P on a rehearsal page, etc.) gets a normal browser-default print, not the drill-formatted layout.

While the drill view is mounted:
- Hides `header, nav, [data-print-hidden]`; reveals `[data-print-only]`.
- Expanded `RepeatingClusterDetails` panels carry `data-print-hidden` so they collapse out of the printed sheet (their info duplicates the row list, and interactive affordances are dead on paper). Page count stays predictable regardless of which panels were open before Cmd+P.
- Forces white surfaces on the body for ink economy.
- `break-inside: avoid` on `.drill-tag-section` and `.drill-row` so dancer/tag groups don't split across pages.
- `.tag-chip` switches to outlined (currentColor border, transparent bg) for B&W printability.

Note: the project page (`/projects/[id]`) does NOT set the `data-print-target` attribute. Printing that page with the drill board expanded will render everything including the cluster panels — the project page was never print-optimized. If we ship a project-level print mode, it should mirror the my-notes `useEffect` pattern.

### What's deliberately deferred

- Dedicated `/projects/[id]/drill-list` sub-route with shareable `?dancer=USER_ID` URLs.
- Whole-company print sheets (instructor printing all dancers in one document).
- PDF export endpoint — `window.print()` → "Save as PDF" is sufficient for v1.
- Curated "tonight's drill list" entity (`DrillSheet` + `DrillSheetItem`) for hand-picked subsets — a lighter "Today's focus" client-side multi-select is the proposed next iteration (see [docs/plans/drill-list-expansion-backlog.md](docs/plans/drill-list-expansion-backlog.md)).
- Per-tag color coding — single neutral chip in v1.
- Multi-tag per note — single tag column.
- Cross-project repeating detection — project-scoped only.

### Strategic backlog

The drill-v2 work documented above is the four-PR commitment from [docs/plans/drill-list-v2-implementation.md](docs/plans/drill-list-v2-implementation.md). The next-tier ideas (today's-focus subset, stalled-aware rows, discussion-context surface, etc.) live in [docs/plans/drill-list-expansion-backlog.md](docs/plans/drill-list-expansion-backlog.md) with their full triage rationale.

## Team Page UI

`/teams/[teamId]` is the organizational home — sits *above* `/projects/[projectId]` in the hierarchy and is intentionally lighter and more administrative than the operational pages below it. The page answers "who is on this team and what projects exist?" Single-column on all sizes; on mobile a `Projects / Members` segmented switcher lets the user focus on one section at a time.

| File | Responsibility |
|---|---|
| [app/teams/[teamId]/page.tsx](app/teams/[teamId]/page.tsx) | Server entry. Fetches projects (with rehearsals → notes → assignments → status, for `openNotesCount` + `lastActivity` derivation), team members, and `PENDING` team invitations in parallel. Maps to flat `ProjectRowData`, `MemberRowData`, and `PendingInvitationRowData` arrays plus a `roleGlance` count by role. Renders `<TeamMetaBand />` above `<TeamMobileTabs />` which slots `<ProjectsSection />` + `<MembersSection />`. The page header carries no CTAs — primary actions live inside each section header. |
| [team-meta-band.tsx](app/teams/[teamId]/team-meta-band.tsx) | Edge-to-edge `bg-card` band. Breadcrumb (Dashboard › team), team mark + title, the viewer's role chip via `RoleChipPopover`, and a desktop meta strip with `MetaChip`s (Members / Projects / Created) + `RoleGlanceStrip` + "Your role" at the end. On mobile the meta strip is hidden; the role chip moves below the title (preventing orphan when the name wraps) and a compact `X members · Y projects` subtitle replaces the desktop helper line. The team mark shrinks to `size-9` on mobile. |
| [team-mobile-tabs.tsx](app/teams/[teamId]/team-mobile-tabs.tsx) | Client wrapper. Renders the `Projects (N) / Members (N)` segmented `role="tablist"` visible only below `lg:`. Body is single-column on all sizes — on mobile the inactive section gets `hidden lg:block` so only the active tab renders; on `lg:+` both sections always render in the same single column. There is intentionally no right rail (see "About card removal" below). |
| [projects-section.tsx](app/teams/[teamId]/projects-section.tsx) | Heading + helper line + list of `ProjectRow`s, OR a generous empty-state panel with a `Create first project` CTA. Filter is **lazy**: defaults to active projects only, no filter UI shown. When `archivedCount > 0`, a single inline link toggles `Show archived (N)` ↔ `Hide archived`. The "no active projects" empty state surfaces the same toggle inline. `New project` button (gated on `canCreate`) sits in the section header. |
| [project-row.tsx](app/teams/[teamId]/project-row.tsx) | Per-project `<Link>` row into `/projects/[projectId]`. Lighter than `RehearsalRow` — these are entry points, not work surfaces. **No progress bar, no left accent stripe** (status is conveyed by the pill alone — stripes are reserved for *augmenting* signals like the "current" rehearsal indicator). Body shows title + status pill + clamped description; right cluster shows rehearsal count, an optional in-progress-tinted "open notes" accent, and a relative `lastActivity` timestamp. Archived rows fade to `opacity-80`. |
| [members-section.tsx](app/teams/[teamId]/members-section.tsx) | Heading + helper line + divided card list. **Pending invitations** (status `PENDING`) render in a muted block above the active members, separated by section subheaders (`Pending invitations · N` / `Members · N`) when both groups are present; the search + role-filter toolbar applies to both. Toolbar is **lazy** (progressive disclosure): **search** appears at `members.length >= 8`; **role filter** appears at `>= 6 members AND >= 3 distinct roles`. Below thresholds, the toolbar is omitted and a chromeless "Invite by email…" footer surfaces for admins. Role-filter pills hide rows for roles with zero count (no dead `Instructor (0)` pill). Sort is role hierarchy first, then alphabetical. |
| [member-row.tsx](app/teams/[teamId]/member-row.tsx) | Client component. Avatar + name + email + "You" pill (own row) + `RoleChipPopover` + joined date (desktop). When `canManage && !member.isYou`, renders a `…` `MemberActionsMenu` (Radix `DropdownMenu`) on the right. Currently exposes **Copy email** (uses `navigator.clipboard` + sonner toast); future actions (`Change role`, `Remove`) slot in here without redesigning the row. Overflow column is reserved (`size-6` placeholder) on rows without actions so rows align consistently. |
| [pending-invitation-row.tsx](app/teams/[teamId]/pending-invitation-row.tsx) | Muted row variant for `PENDING` invitations. Avatar (initials from email) + email + "Pending" pill (in-progress tint) + role chip + "Invited Xd ago" / "Expires in N" meta. Admin overflow menu: **Resend invite** (rotates token, fires fresh email, resets 7-day expiry), **Copy email**, **Revoke** (kills the token immediately). Actions go through `useTransition` + sonner toasts. See "Team Invitations" for the full invitation lifecycle. |
| [role-chip.tsx](app/teams/[teamId]/role-chip.tsx) | Pure presentational `RoleChip` (server-safe) + `ROLE_LABEL` + `ROLE_INFO` constants. `ROLE_INFO` is shaped as `{ sees, canDo }` per role so the popover can render the visibility/permissions split — the same data also feeds the `/privacy` visibility table. Token mapping: ADMIN = `--status-addressed-*` (teal), INSTRUCTOR = `--note-voice-*` (coral), ASSISTANT = `--status-progress-*`, DANCER = neutral muted. |
| [role-chip-popover.tsx](app/teams/[teamId]/role-chip-popover.tsx) | Client wrapper that wraps `RoleChip` in a `Popover` showing the role label plus a two-row `<dl>`: **Sees** (what this role can view in the team workspace) and **Can do** (what they can write). **Replaced the persistent role glossary card** — explanation is surfaced contextually wherever a role appears (header, member rows). Used everywhere the team page renders a role chip. |
| [new-project-button.tsx](app/teams/[teamId]/new-project-button.tsx) / [invite-member-button.tsx](app/teams/[teamId]/invite-member-button.tsx) | Client `Dialog` triggers wrapping `CreateProjectForm` / `AddTeamMemberForm` (the latter calls `inviteTeamMember` and sends an email invitation rather than directly creating a `TeamMember` row — see "Team Invitations"). Both forms are chromeless (no `Card`) and accept `onSuccess` / `onCancel` so the dialog closes on submit. |

**About card removal**: the page originally had an `AboutTeamCard` in a right rail containing a role glossary + Created date. The glossary moved into `RoleChipPopover` (contextual help over persistent help), which left the card with just the Created date — not enough to justify a rail. The card was deleted, the rail was deleted, and the Created date moved into the desktop meta strip as a third `MetaChip`. The rail can come back when there's substantial content to put in it (team activity, pending invites, team description).

**Header CTAs**: the meta band intentionally carries no action buttons. Each section owns its primary action (`New project` in ProjectsSection, `Add member` in MembersSection). This eliminates duplicate CTAs and follows the action-ownership pattern.

## Project Page UI

`/projects/[projectId]` is a structural bridge into the rehearsal workspace — a lighter-weight page that orients the user (which project, what state, what's next) and surfaces rehearsals as the primary object. Desktop is a two-column shell (rehearsal spine + a rail stacking Groups above Resources). On mobile, a three-tab segmented switcher toggles between **Rehearsals**, **Groups**, and **Resources** so the user can focus on one at a time.

| File | Responsibility |
|---|---|
| [app/projects/[projectId]/page.tsx](app/projects/[projectId]/page.tsx) | Server entry. Fetches the project, rehearsals (with notes/assignments/authors/video duration), groups, team members, **discussions** (via `getDiscussionsForProject`), and **resources** (via `getResourcesForProject`) in parallel. Aggregates per-rehearsal totals (text/voice counts, assignment status counts, distinct contributors, stalled count via [`isNoteStalled`](lib/notes/stalled.ts)) and project-wide totals (rehearsal count, cast count, open notes, distinct contributors). Also runs `getActiveAssignmentsForProjects` + `detectRepeatingClusters` to build per-dancer drill recipients and cluster summaries. Maps each discussion through `summarizeThread` server-side so chip seeds paint without a client round-trip. Renders `<ProjectMetaBand />` above `<RepeatingClustersCard />` + `<ProjectDrillSection />` + `<DiscussionsSection />` + `<ProjectMobileTabs>` which slots `<RehearsalsSection />` + `<ProjectGroupsSection />` + `<ProjectResourcesSection />`. |
| [repeating-clusters-card.tsx](app/projects/[projectId]/repeating-clusters-card.tsx) | Tinted summary card listing active repeating clusters one row at a time. **Staff-only** — gated on `isStaff` in the page entry. See "Drill surfaces" above. |
| [project-drill-section.tsx](app/projects/[projectId]/project-drill-section.tsx) | Per-dancer collapsible drill board for the project. **Staff-only** — gated on `isStaff` in the page entry. See "Drill surfaces" above. |
| [discussions-section.tsx](app/projects/[projectId]/discussions-section.tsx) | Section card sitting between `ProjectDrillSection` and `ProjectMobileTabs`. **Unconditional** (visible to all roles, including dancers) but **collapsed by default** so it doesn't push the rehearsals/groups navigation targets down the page. Collapsed state is a single thin row: `💬 Discussions · {N} · {U unread}` (the unread pill only appears when U > 0). Tapping the row expands → composer + list + cap-hit indicator beneath. Expansion is persisted in the URL via `?discussions=open` (bookmarkable, survives back/forward) using `router.replace({ scroll: false })` so the page doesn't jump when toggled. Unread count is derived client-side from the discussions' `thread.hasUnread` flags (already populated server-side via `summarizeThread`). When expanded, wraps the list in `ThreadExpansionProvider` so threads coordinate within the section. When the result hits the 50-row cap (`PROJECT_DISCUSSIONS_CAP` mirrors the helper's `take: 50`), surfaces "Showing the latest 50…" copy at the bottom — the cheap-hedge stand-in for proper pagination per the Decisions log. |
| [project-discussion-row.tsx](app/projects/[projectId]/project-discussion-row.tsx) | Mirror of the workspace `discussion-row.tsx` adapted for the project-wide list. The top meta row shows a **scope badge** that distinguishes project-level (`<MessagesSquare /> Project-wide` chip, tinted with `--discussion-accent`) from rehearsal-anchored (`Rehearsal: {title}` chip that links to `/rehearsals/[id]`). When the discussion is video-anchored, the timestamp pill is wrapped in a `<Link>` to the rehearsal — deep-linking to the exact frame via `?t=` is deferred. Voice rows reuse `VoiceNotePlayer` in **standalone mode** (no `videoRef` or `startTimestampMs` since there's no video on this page) and `VoiceNoteTranscript` with `canRetry` driven by the section's `canRetryTranscript` prop (which mirrors `isStaff`; the API enforces author-or-staff regardless). |
| [project-discussion-composer.tsx](app/projects/[projectId]/project-discussion-composer.tsx) | Text-only composer for true project-level discussions. Posts to `POST /api/projects/[projectId]/discussions` with `rehearsalId: null`. Voice + anchored variants are deliberately workspace-only in v1 — voice requires a rehearsal anchor (per `AudioAsset.rehearsalId`), and anchoring is rehearsal-scoped by definition. Cmd/Ctrl+Enter sends; `router.refresh()` on success. |
| [project-meta-band.tsx](app/projects/[projectId]/project-meta-band.tsx) | Edge-to-edge `bg-card` band. Breadcrumb (Dashboard › team › project), title + `ProjectStatusPill` + `RolePill`, optional description, actions slot, and a meta strip with `MetaChip`s (Rehearsals / Cast / Open notes). On mobile the meta strip flattens into compact `[icon] {value} {label}` chips on a single line, the description is `line-clamp-2`, the title shrinks to `text-xl`, the breadcrumb's "Dashboard" segment is hidden, and the contributor `AvatarStack` is hidden. On `sm:+` it gains the eyebrow + `border-t` divider + accent suffix + the contributor stack. |
| [project-mobile-tabs.tsx](app/projects/[projectId]/project-mobile-tabs.tsx) | Client wrapper. Renders a three-button segmented `role="tablist"` (`Rehearsals (N)` / `Groups (N)` / `Resources (N)`) visible only below `lg:`, plus the `lg:grid-cols-[minmax(0,1fr)_320px]` two-column layout. On mobile only the active panel renders (the other two carry `hidden lg:block` so they re-show at `lg:+`); Groups stacks above Resources in the desktop rail. Default tab on mobile is Rehearsals. Each tab button carries `min-w-0 flex-1` so the count pill can't bleed out of the tablist on 320px-class viewports — the label uses `truncate` (gives way first), the count pill is `shrink-0` (preserved), and below `sm:` the buttons tighten to `text-[13px] px-2 gap-1`. |
| [rehearsals-section.tsx](app/projects/[projectId]/rehearsals-section.tsx) | Heading + helper line + list of `RehearsalRow`s, OR a generous empty-state panel guiding staff to create the first rehearsal (gated on `canManage`). |
| [rehearsal-row.tsx](app/projects/[projectId]/rehearsal-row.tsx) | Per-rehearsal `<Link>` row into `/rehearsals/[id]`. CSS-grid layout on `md:+` (date plate / body / progress / chev) collapsing to a single column on mobile. Left accent stripe is teal for the **current** rehearsal and neutral otherwise. Body shows duration (or "No video yet"), total notes (with coral voice-note tally), small contributor stack, relative date, and a `Clock + N stalled` chip when applicable. Progress block uses `NoteProgressBar` with `closed/total · pct%` plus an "All notes resolved" badge or `n open · n working · n done` caption. |
| [project-groups-section.tsx](app/projects/[projectId]/project-groups-section.tsx) | Compact rail card. Heading + slim `+ New` button → optional inline `CreateGroupForm` → single-column list of `GroupCard`s. Each `GroupCard` shows the name, an "empty" pill tinted with the in-progress palette when membership is zero, an icon-only edit/delete pair (gated on `canManage`), and either an inline "Add members" CTA or a flex-wrapping pill list with `AvatarInitials` + name. CRUD pipeline (`createProjectGroup`, `updateProjectGroupMembers`, `deleteProjectGroup`) is unchanged. |
| [project-resources-section.tsx](app/projects/[projectId]/project-resources-section.tsx) | Compact rail card below Groups. Heading + slim `+ New` button (staff-only) → optional inline `ResourceForm` → single-column list of `ResourceRow`s. Each row: `Link2` icon + title-as-link (`<a target="_blank" rel="noopener noreferrer">`) + `ExternalLink` decoration + domain hint + optional description (`line-clamp-1`) + author `AvatarInitials` + first name + relative time + optional `· edited`. Author-only `…` overflow menu with Edit (swaps the row to the form in-place) and Delete (`window.confirm`). Empty state branches on `canManage` — staff get an `Add first resource` CTA, dancers get a muted "No resources yet" line. CRUD pipeline (`createResource`, `updateResource`, `deleteResource`) lives in [resource-actions.ts](app/projects/[projectId]/resource-actions.ts). See "Project Resources" above. |
| [new-rehearsal-button.tsx](app/projects/[projectId]/new-rehearsal-button.tsx) | Client `Dialog` trigger wrapping `CreateRehearsalForm`. Used both as the meta band's primary action and inside the empty state. The form is chromeless (no `Card` wrapper) and accepts `onSuccess` / `onCancel` so the dialog can close after a successful submit. |

**"Current" rehearsal**: server-derived as `idx === 0 && rehearsals.length > 1` after sorting by `rehearsalDate desc`. A solo rehearsal does not get the Current treatment to avoid noise.

**Project status pill**: derived from `Project.status` (`ACTIVE | ARCHIVED`). Active uses the `--status-addressed-*` (teal) palette so it harmonizes with the rest of the app.

**Stalled count per rehearsal**: same `isNoteStalled` helper as `/notes-by-me`, with `now = new Date()` injected once per request.

## Global App Header & Team Switcher

The persistent header lives in [components/app-header.tsx](components/app-header.tsx) and is mounted once in [app/layout.tsx](app/layout.tsx). It renders on every page (signed-in or not), but the team switcher and team-aware data fetching only kick in when the user is signed in.

| File | Responsibility |
|---|---|
| [components/app-header.tsx](components/app-header.tsx) | **Server component**. Reads pathname from `headers().get("x-pathname")`, runs `getCurrentDbUser()` to check auth, then in parallel fetches `getTeamsForUser(dbUser.id)` and `resolveCurrentTeamId(pathname, dbUser.id)`. Renders `<BrandLockup size="sm" />`, signed-in/out gates, the `<ThemeToggle>`, and Clerk's `UserButton` as plain server JSX (the lockup, toggle, and UserButton are client/interactive islands; the rest is server JSX), plus `<TeamSwitcher teams={...} currentTeamId={...} />`. Signed-out: replaces UserButton with `<SignInButton mode="redirect">` + `<SignUpButton mode="redirect">` (Sign Up styled with `bg-primary`). |
| [components/brand-lockup.tsx](components/brand-lockup.tsx) | **Shared brand component**. Single source of truth for the "8 + Eight Count + AudioLines" mark — used by the navbar (`size="sm"`), the sign-in brand panel (`size="lg" showCountDots`), and the sign-up brand panel (`size="lg" showCountDots`). Props: `size` ("sm" auto-collapses wordmark + icon below `sm:` breakpoint; "lg" always-visible), `showCountDots` (renders 8 small `--primary/60` dots beneath the wordmark — auth pages only since the dots want horizontal room to read as 8 distinct beats), `href` (default `/`). **v1 placeholder**: when a designed logo eventually lands, this is the only file that needs to change — every consumer auto-updates. |
| [components/team-switcher.tsx](components/team-switcher.tsx) | **Client component**. Radix `<Popover>` trigger (avatar + truncated team name + role chip + chevron) → list of all teams the user belongs to (each row uses `<AvatarInitials toneSeed={team.id}>` + `<RoleChip>`, current team gets a check) → "+ Create team" footer that opens a `<Dialog>` wrapping the chromeless `CreateTeamForm`. Trigger truncates at `max-w-56`; role chip hides below `sm:`. **Derives the active team client-side from `usePathname()`** (`/teams/[id]` → extracts the id directly; `/dashboard`, `/my-notes`, `/notes-by-me`, `/` → null; project/rehearsal paths → falls back to the server-passed `currentTeamId` prop). This is load-bearing because the `AppHeader` lives in the root layout — Next.js preserves the root layout across client-side navigations, so the server-resolved `currentTeamId` would otherwise go stale the moment a user clicked a team in the switcher and SPA-navigated to `/teams/[newId]` (no layout re-render, no prop update, checked-state never moves). The client-side derivation keeps the trigger label + the row check in sync without forcing a `router.refresh()`. |
| [components/theme-toggle.tsx](components/theme-toggle.tsx) | **Client component**. Three-state Light / Dark / System dropdown — see "Theming & dark mode" above. |
| [lib/teams/get-teams-for-user.ts](lib/teams/get-teams-for-user.ts) | One Prisma query joining `TeamMember → Team`, returns `{ id, name, role }[]` ordered by membership creation desc. Exports `TeamSwitcherTeam` type. |
| [lib/teams/resolve-current-team-id.ts](lib/teams/resolve-current-team-id.ts) | Pure pathname → teamId resolver. Handles `/teams/[id]` (direct), `/projects/[id]` (looks up `project.teamId`), `/rehearsals/[id]` (looks up `rehearsal.project.teamId`). Each lookup verifies team membership in the same query so the switcher never highlights a team the viewer can't access. Returns `null` on cross-team or unauth pages. |
| [proxy.ts](proxy.ts) | Extends `clerkMiddleware` to forward `req.nextUrl.pathname` as an `x-pathname` request header via `NextResponse.next({ request: { headers: ... } })`. This is the load-bearing piece that lets the server-rendered `AppHeader` know what page it's on. |

**Architecture rationale**: keeping the header on the server (with a client island for the popover/dialog) means the team list is baked into the HTML at first paint — no fetch-on-mount, no loading flash, no skeleton state. The `x-pathname` header trick exists because Next.js doesn't expose pathname to server components natively, and we want full URL detection without resorting to client-side fetches for `/projects` and `/rehearsals` pages.

**Create-team flow**: the dialog reuses [app/dashboard/create-team-form.tsx](app/dashboard/create-team-form.tsx) which is **chromeless** (no `Card` wrapper) and accepts `onSuccess({ teamId, teamName })` / `onCancel`. The same form is used in `<NewTeamButton>` on the dashboard. After creation, the switcher closes the dialog and navigates to `/teams/[newTeamId]` so the user lands in their fresh admin context. The `createTeam` server action returns `{ success, teamId, error? }` — the `teamId` enables this navigation.

## Dashboard UI

`/dashboard` is the signed-in home — the only page that aggregates *across* teams. Cohesive with the rest of the app's vocabulary: edge-to-edge meta band on top, mobile-first responsive, compact rows, sections own their actions.

| File | Responsibility |
|---|---|
| [app/dashboard/page.tsx](app/dashboard/page.tsx) | Server entry. Three parallel Prisma queries: memberships with team + projects (with most-recent rehearsal date per project + `_count.members` and `_count.invitations` for the onboarding checklist's "Invite a teammate" derivation), my `NoteAssignment`s (for "on plate" count), and notes I authored (for total + stalled count). Aggregates per-team rows (`TeamRowData` with project count and `lastActivityAt = max(rehearsalDate)`), `MyNotesMetrics`, `NotesByMeMetrics`, and the onboarding `ChecklistInput`. Computes `showNotesByMe` from whether the user has any membership with an authoring role. Renders `<DashboardMetaBand />` above `<main>` containing `<OnboardingChecklist />` + `<WorkTiles />` + `<TeamsSection />`. See "Onboarding tour" below for the checklist. |
| [app/dashboard/onboarding-checklist.tsx](app/dashboard/onboarding-checklist.tsx) | Client checklist card slotted above `WorkTiles`. See "Onboarding tour" below for behavior, state machine, and per-step skip semantics. |
| [app/dashboard/dashboard-meta-band.tsx](app/dashboard/dashboard-meta-band.tsx) | Edge-to-edge `bg-card` band. "Welcome back, {firstName}" or just "Welcome back" if `dbUser.name` is empty (no email-fallback — emails can be weird). Meta strip with `MetaChip`s for Teams + On your plate. Mobile collapses chips into compact `[icon] {value} {label}` form on a single line, drops the `border-t` separator, and shrinks the title to `text-xl`. |
| [app/dashboard/work-tiles.tsx](app/dashboard/work-tiles.tsx) | Two-up `<Link>` tiles (`grid-cols-2` at every viewport — they're dense enough to fit on mobile, much better than the old single-column big cards). Each tile: icon + uppercase eyebrow + big tabular number + descriptor. Notes-by-me also surfaces a tinted "M stalled" pill (using `--status-progress-*`) when `stalled > 0`, and the whole tile picks up a soft progress-tint background to flag it. Empty values get a friendlier line ("All caught up", "Nothing assigned yet"). The Notes-by-me tile is omitted entirely when `showNotesByMe` is false (pure-dancer users). |
| [app/dashboard/team-row.tsx](app/dashboard/team-row.tsx) | Single-column compact `<Link>` row matching the `RehearsalRow` / `ProjectRow` family: `<AvatarInitials size={40} toneSeed={team.id}>` + name + meta line ("**N projects · last active 2d ago**" — falls back to "no projects yet" or "no rehearsals yet" when relevant) + `<RoleChip>` + chevron. Local `formatRelative` follows the same pattern other rows use. |
| [app/dashboard/teams-section.tsx](app/dashboard/teams-section.tsx) | Section header ("Your teams" + helper line + `<NewTeamButton />`) above the row list. When the user has no teams, renders a generous empty-state panel with a primary `Create your first team` CTA (`navigateOnSuccess` so first-time users land directly in their new team). |
| [app/dashboard/new-team-button.tsx](app/dashboard/new-team-button.tsx) | Client `<Dialog>` trigger wrapping the chromeless `CreateTeamForm`. Two variants: section-header default (small outline button, refresh on success so the new row appears) and empty-state primary (default size, navigates to the new team on success). Same form, same dialog shape as the team switcher's create flow. |
| [app/dashboard/create-team-form.tsx](app/dashboard/create-team-form.tsx) | Chromeless form (no `Card` wrapper). Accepts `onSuccess({ teamId, teamName })` / `onCancel`. Reused by the team switcher's Create-team dialog. |
| [app/dashboard/types.ts](app/dashboard/types.ts) | `TeamRowData`, `MyNotesMetrics` (`onPlate`, `total`), `NotesByMeMetrics` (`total`, `stalled`). |

**`onPlate` derivation**: count of `NoteAssignment`s where `(status?.status ?? "OPEN")` is OPEN or IN_PROGRESS — same active-status definition as everywhere else (via `isActiveStatus` from [lib/notes/statuses.ts](lib/notes/statuses.ts)).

**`stalled` derivation**: same `isNoteStalled` helper used on `/notes-by-me` and `/projects/[id]`, called once per request with a single shared `now`. Each authored note is tested against its (lazily fetched) assignments + statuses.

**Layout**: the meta band is full-width edge-to-edge; the main body is constrained by `mx-auto max-w-5xl` with `p-4 sm:p-6` and `gap-6 sm:gap-8`. Tiles stack inside a 2-col grid; team rows stay single-column on all sizes for parity with the other list-style sections in the app.

## Shared note primitives

| File | Use |
|---|---|
| [components/note-progress-bar.tsx](components/note-progress-bar.tsx) | Stateless 4-segment stacked bar. Takes pre-aggregated `counts: Record<NoteStatus, number>` + optional `height`. Used by `NotesSummary` (workspace), `AuthorSummaryStrip`, and per-note `AuthoredNoteCard`. |
| [components/avatar-initials.tsx](components/avatar-initials.tsx) | Initials avatar with deterministic tone hashing (DJB2 over `toneSeed` modulo 4 non-neutral tones). Uses `--avatar-tone-*` CSS variables so it adapts when `.dark` is applied. |
| [components/note-rehearsal-link.tsx](components/note-rehearsal-link.tsx) | `project › rehearsal-title` breadcrumb link to `/rehearsals/[id]`. |
| [components/note-timestamp-pill.tsx](components/note-timestamp-pill.tsx) | Accent-tinted mono pill (`var(--primary)` for text, `var(--note-voice-accent)` for voice). Renders as a `<button>` when `onClick` is set, otherwise a static `<span>`. |
| [components/section-tab-nav.tsx](components/section-tab-nav.tsx) | Thin sub-nav (`My notes` / `Notes by me`) rendered below the global header on the two notes pages. Active tab is auto-derived from `pathname` but can be overridden. |
| [components/tag-chip.tsx](components/tag-chip.tsx) | Single neutral chip (`--muted` / `--muted-foreground`) carrying a `NoteTag`. Has the `tag-chip` class for the print stylesheet to switch to outlined rendering. |
| [components/repeating-chip.tsx](components/repeating-chip.tsx) | Plum-tinted chip (`--repeating-*`) with `Repeat` icon. `compact` mode shows `Repeating × 3`; default mode shows `Repeating · Timing × 3`. Pure presentational `<span>` — interactive expansion lives in `ExpandableRepeatingChip` below. |
| [components/expandable-repeating-chip.tsx](components/expandable-repeating-chip.tsx) | `<button>`-wrapped variant that toggles an inline `RepeatingClusterDetails` panel. Consumes `RepeatingClusterExpansionProvider` for coordinated expansion (one panel on mobile, many on desktop); falls back to local state standalone. Used on both drill surfaces. See "Expandable cluster details" under Repeating-correction detection. |
| [components/repeating-cluster-details.tsx](components/repeating-cluster-details.tsx) | The inline detail panel — quoted latest body, clickable timestamp pills (capped at 8 + "+N more"), "View latest note in {rehearsalTitle}" link. Carries `data-print-hidden`. |
| [components/repeating-cluster-expansion-context.tsx](components/repeating-cluster-expansion-context.tsx) | `RepeatingClusterExpansionProvider` + `useRepeatingClusterExpansion()` hook. Mirrors `ThreadExpansionProvider`'s "one on mobile, many on desktop" semantics. Each surface mounts its own provider (independent coordination scope). |
| [components/threads/thread-attachment.tsx](components/threads/thread-attachment.tsx) | Single entry point for surfacing a note's thread (collapsed chip + expandable thread + reactions + composer) on any note-row surface. Seeds from server-side `summarizeThread`. See "Note threads" above for the full component breakdown. |
| [components/threads/unread-comments-indicator.tsx](components/threads/unread-comments-indicator.tsx) | Small `--primary`-tinted "N new" pill for the dashboard's "you have new replies" surfacing. |
| [lib/notes/format.ts](lib/notes/format.ts) | `formatNoteTimestamp(ms)` — single source of truth for `mm:ss` rendering across the app. The workspace's `./utils.ts` re-exports this as `formatTimestamp` so its many existing imports keep working. |
| [lib/notes/stalled.ts](lib/notes/stalled.ts) | `isNoteStalled({ createdAt, assignments, now })` + `STALLED_THRESHOLD_DAYS = 3`. Pure, server- and client-safe; `now` is injectable so it's deterministic in tests. |
| [lib/notes/tags.ts](lib/notes/tags.ts) | `NOTE_TAGS` const tuple, `NoteTag` type, `NOTE_TAG_LABELS`, `NOTE_TAG_DESCRIPTIONS`, `isNoteTag` runtime guard. Mirrors the Prisma enum literally (no Prisma import) so the module stays client-safe. |
| [lib/notes/repeating.ts](lib/notes/repeating.ts) | `detectRepeatingClusters`, `buildRepeatingMarkerByAssignmentId`, `indexClustersByUserAndTag`, `REPEATING_THRESHOLD = 3`. Also exports `RepeatingClusterDetail` + `RepeatingClusterDetailItem` types for the expandable cluster panel — built inline by each surface from its already-fetched active assignments. Pure derivation. See "Repeating-correction detection" above. |
| [lib/notes/drill-sort.ts](lib/notes/drill-sort.ts) | `compareDrillPriority` + `sortByDrillPriority<T>(rows, toKey)`. Pure helper that imposes the within-tag-bucket order on drill surfaces: repeating first → oldest unresolved → newest rehearsal → tiebreaker `id`. Accessor-pattern so `/my-notes` (nested `AssignedNoteRow`) and the project page (flat `DrillItem`) can share the sort without sharing a row shape. |
| [lib/threads/reactions.ts](lib/threads/reactions.ts) | `REACTION_KINDS` tuple, `ReactionKind` type, `REACTION_EMOJI` / `REACTION_LABELS` / `REACTION_DESCRIPTIONS`, `isReactionKind` runtime guard. Mirrors the Prisma `ReactionKind` enum literally (no Prisma import) so the module is client-safe. |
| [lib/threads/comments.ts](lib/threads/comments.ts) | **Client-safe.** `COMMENT_MAX_LENGTH`, thread types (`ThreadComment`, `ThreadReactionSummary`, `ThreadPayload`, `ThreadSummary`), and the pure `summarizeThread` (chip-seed helper called once per note on every list query). |
| [lib/threads/thread-access.ts](lib/threads/thread-access.ts) | **Server-only** (guarded by `import "server-only"`). Prisma-touching helpers parameterized over `ThreadTarget`: `canViewThread(target, userId)` (team-membership gate) and `loadThread(target, viewerId)` (full thread serialization with tombstones + per-author role pills). Split out so the Postgres client doesn't leak into the browser bundle when a client component imports `COMMENT_MAX_LENGTH` or a type. |
| [lib/threads/get-unread-comment-count.ts](lib/threads/get-unread-comment-count.ts) | `getUnreadCommentCountForUser(userId)` — combined dashboard chip number for note + discussion thread unreads. See "Note threads → Dashboard unread surfacing" above for the scoping rules (notes engagement-scoped; discussions membership-scoped). |
| [lib/notes/get-active-assignments-for-project.ts](lib/notes/get-active-assignments-for-project.ts) | Server-side query helper returning all OPEN / IN_PROGRESS (and status-absent) assignments for the given project IDs, with the user / status / note.tag / rehearsal info needed for cluster detection and the drill board. |

## Landing Page UI

`/` is the unauthenticated landing — pitched at first-time visitors, mobile-first, all built from the app's existing primitives and tokens (no new design language). Tone is warm / craft-focused; the "Eight Count" wordmark in the hero, "feedback that lands / stays landed" headline emphasis on `--primary`, and the inline note mockup all match the rest of the app.

| File | Responsibility |
|---|---|
| [app/page.tsx](app/page.tsx) | Section components inlined as sibling functions (`Hero`, `ProblemSection`, `HowItWorksSection`, `FeaturesSection`, `RolesSection`, `BuiltForTrustSection`, `FinalCtaSection`, `SiteFooter`) plus four helper components (`Step`, `Feature`, `RoleCard`, `TrustPoint`). Copy lives next to the JSX that renders it — no separate copy module. |
| [app/landing/note-mockup.tsx](app/landing/note-mockup.tsx) | Static, illustrative voice-note card built from the same vocabulary as the real workspace `NoteRow` (coral accent stripe, `02:14` timestamp pill, voice-player pill with 32-bar decorative waveform, "To: Front line" audience chip, three recipient chips with `<AvatarInitials>` + status dots). Initials only (TC / LM / JR), no real user data. `role="img"` with descriptive `aria-label`. |

**Section anatomy**: Hero (positioning eyebrow + headline with `--primary`-emphasized phrases + subhead + Get-started CTA + sign-in link + **beta+18+ disclaimer line** linking to `/privacy#who` + inline mockup) → Problem (single centered prose paragraph) → How it works (3 numbered cards) → What makes it different (2×2 feature grid; "voice notes" card uses the coral accent, "stalled detection" uses the in-progress tint) → For everyone in the room (4-up `<RoleChip>` cards) → **Built for trust** (3-up trust-point cards: per-team workspaces, private media, what we won't do, with a "Read the full privacy details" link to `/privacy`) → Final CTA (closing line + Get-started button + small "for dancers 18 and over" footnote) → **Site footer** with Privacy link.

**CTAs**: both "Get started" buttons use `<SignUpButton mode="redirect" forceRedirectUrl="/dashboard">`, the secondary "Already on a team? Sign in" uses `<SignInButton mode="redirect" forceRedirectUrl="/dashboard">`. All three sign-in surfaces (header, hero, final CTA) behave identically and route to `/sign-in` or `/sign-up`.

**Vocabulary**: "notes" is the artifact (used in eyebrow, subhead, features, steps, roles); "feedback" is the abstract concept / activity (used only in the headline wordplay and the problem/final-CTA emotional beats). Mirrors how the product itself uses the words.

## Onboarding tour

A lightweight, dismissible **dashboard checklist** plus per-page **contextual tips** help new users get oriented without forcing a modal walkthrough. Built on the principle that progressive disclosure outperforms forced tours: low skip rate, just-in-time learning, easy to extend.

### Data model

A single nullable JSON column on `User` holds every dismissal flag — no separate table. Defensive parsing in [lib/onboarding/state.ts](lib/onboarding/state.ts) means a malformed blob never crashes the app.

```ts
type OnboardingState = {
  checklistDismissedAt?: string;                         // ISO; user clicked "Hide"
  checklistStepsSkipped?: Record<string, string>;        // ChecklistStepKey → ISO
  tipsDismissed?: Partial<Record<TipGroupKey, string>>;  // "workspace" / "myNotes" → ISO
};
```

`ensureDbUser()` only writes `email` / `name` / `imageUrl`, so Clerk syncs never clobber `onboardingState`.

**Step "done" is derived from real data**, not stored separately. Once the user invites a teammate, the row checks itself off automatically. This keeps the data model tiny and prevents drift between stored flags and reality. The `checklistStepsSkipped` flag is a fallback — used only when the user explicitly waves a step off without doing it.

### Checklist (`/dashboard`)

| File | Responsibility |
|---|---|
| [lib/onboarding/state.ts](lib/onboarding/state.ts) | Type, defensive parser (factored into small `asStringRecord` / `pickStringEntries` / `pickAllStringEntries` helpers to keep cognitive complexity low), async helpers (`dismissChecklist`, `skipChecklistStep`, `dismissTipGroup`, `resetOnboarding`). Uses `Prisma.DbNull` (not literal `null`) to clear the JSON column. |
| [lib/onboarding/derive-checklist.ts](lib/onboarding/derive-checklist.ts) | Pure function `deriveChecklist(input)`. Six steps: `join-team`, `invite-teammate`, `add-project`, `create-rehearsal`, `leave-note`, `check-inbox`. Each step has `visible` (role-gated — e.g. `invite-teammate` only shown to admins, `leave-note` only to staff roles) and `done` (data-derived) booleans plus a deep-link `href`. Exports `CHECKLIST_STEP_KEYS` const array + `isChecklistStepKey` type guard for runtime validation in the server action. |
| [app/dashboard/onboarding-actions.ts](app/dashboard/onboarding-actions.ts) | `dismissChecklistAction()`, `skipChecklistStepAction(stepKey)` (validates the key via `isChecklistStepKey`), `dismissTipGroupAction(group)`, `restartOnboardingAction()` (clears the entire `onboardingState` — the single-action replay path). |
| [app/dashboard/onboarding-checklist.tsx](app/dashboard/onboarding-checklist.tsx) | Client card slotted above `<WorkTiles>`. Header (Sparkles eyebrow + title + dismiss `×`), progress bar (filled by done + skipped count), and an `<ol>` of step rows. Each row is a `<Link>` to `step.href` with a sibling **Skip** button (when `!step.done && !skipped`). Skipped rows render with a dashed-circle indicator + muted title + italic "Skipped — tap to revisit" line; they remain clickable, and once the underlying action is done, the data-derived `done` state takes precedence over the skip. |

**State machine**:
- `!isDismissed && !isComplete` → full checklist visible.
- `!isDismissed && isComplete` → "You're all set" celebratory state with manual dismiss `×`.
- `isDismissed && !isComplete` → slim "Onboarding hidden — Show again" line. Clicking "Show again" calls `restartOnboardingAction()` which clears the entire `onboardingState` — both the checklist *and* tip-group flags reset, so workspace + my-notes tips return too. Skip flags are also cleared.
- `isDismissed && isComplete` → renders nothing (per v1; replay is intentionally limited to the incomplete-dismissed window).

`isComplete` counts skipped rows as done — the user has explicitly waved them off, so the checklist clears even on the solo-explorer path (e.g. they skip "Invite a teammate" because they're just trying it out).

**Skip-aware completion math**: `isEffectivelyDone(step) = step.done || skippedKeys.has(step.key)`. Used both for the progress bar's `doneCount` and the `isComplete` check. The dashboard's `page.tsx` builds the typed `Set<ChecklistStepKey>` from `onboardingState.checklistStepsSkipped`, filtering through `isChecklistStepKey` so stale keys (e.g. from a renamed step) don't leak in.

### Contextual tips

Tip popovers appear on `/rehearsals/[id]` (3 tips: timeline / composer / notes list) and on `/my-notes` (2 tips: Up-next hero / filter rail). Each surface is a "tip group" (`workspace` or `myNotes`) that dismisses as a unit.

| File | Responsibility |
|---|---|
| [components/onboarding/contextual-tip.tsx](components/onboarding/contextual-tip.tsx) | Portaled, fixed-positioned popover with edge-aware placement (above/below depending on viewport space), pointer triangle aligned to the anchor's center, "Tip n of N" eyebrow, body, **Skip / Got it** (or **Next**) buttons, and an `<AnchorHighlight>` ring around the anchor element. Position-tracking via `getBoundingClientRect()` + `ResizeObserver` + capturing `scroll` listener (catches ancestor-scroll events). Renders nothing during SSR (`typeof document === "undefined"`) or while `coords` is unresolved — no separate `mounted` flag needed. Uses `--popover` / `--primary` tokens so it adapts to dark mode. |
| [components/onboarding/tip-sequence.tsx](components/onboarding/tip-sequence.tsx) | Controller. Takes `groupKey`, `steps[]` (with `anchorSelector` strings), `initiallyDismissed`, and optional `enabled` gate. On each step, queries `document.querySelector(step.anchorSelector)` with retry (~3s of 100ms attempts) — if the anchor never appears, advances to the next step (or dismisses the group if it was the last) rather than blocking. Calls `dismissTipGroupAction(groupKey)` via `useTransition` on Skip / final Got it. |

**Anchor pattern**: tips anchor via `data-onboarding-anchor="key"` attributes on existing wrapper elements. No ref-drilling into existing components — keeps the workspace and my-notes components clean. Anchors used:
- `workspace-timeline`, `workspace-composer`, `workspace-notes` (rehearsal workspace, mounted in [rehearsal-workspace.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-workspace.tsx))
- `my-notes-hero`, `my-notes-rail` ([my-notes-list.tsx](app/my-notes/my-notes-list.tsx))

**Mounting gates**:
- Workspace tips: `canAuthorNotes && playbackUrl !== null` — pure dancers don't get the workspace tour (the composer anchor only exists for note-authors); staff don't see it until the video URL resolves so the timeline anchor isn't pointing at empty chrome.
- My-notes tips: `rows.length > 0` — empty inbox skips the tour entirely (the hero anchor isn't rendered when there are no notes).

The page server entries ([app/rehearsals/[rehearsalId]/page.tsx](app/rehearsals/[rehearsalId]/page.tsx) / [app/my-notes/page.tsx](app/my-notes/page.tsx)) read `dbUser.onboardingState`, parse it via `parseOnboardingState`, and pass `tipsDismissed` flags down to the client components as boolean props.

### Backfill for existing users

The migration only adds the column. Marking existing active users as already-onboarded happens in a separate runnable script so it doesn't ship as part of the schema change.

[scripts/backfill-onboarding-state.ts](scripts/backfill-onboarding-state.ts) — `npm run db:backfill-onboarding` (uses `tsx` as a devDep). Marks every user with prior activity (`TeamMember`, `Note`, or `NoteAssignment` row) as having dismissed the checklist and all tip groups. **Idempotent**: re-runs only update users whose state hasn't been backfilled yet (parsed `checklistDismissedAt` is empty).

The script has a `SKIP_EMAILS` array at the top of the file, defaulted to test-account emails (currently `lgomez00714@gmail.com`). Anyone listed there is *not* marked as dismissed even if they have activity — useful for walking through onboarding with an account that already has rehearsals / notes / etc. **Clear that list before running in production**, otherwise listed users will see the tour despite being established users.

## In-app feedback widget

A low-friction channel for users to send bugs, ideas, questions, and praise from anywhere in the signed-in app, plus an unlisted admin inbox at `/admin/feedback` for the operator (you) to triage and reply. Designed for a small beta — single admin, email-as-conversation-channel, no public roadmap board, no in-app "my feedback" page.

**Defining contrast with notes / discussions:**
- **Cross-product, not team-scoped.** Lives at the user→app boundary, not inside a team's workspace. Anyone signed in can submit; only the operator (admin email allowlist) can triage.
- **Email-as-channel.** Submission emails the operator with the submitter's address set as `replyTo` so plain "Reply" routes back. Operator's reply (sent from `/admin/feedback/{id}`) lands in the submitter's inbox with the operator's address as `replyTo`. The DB row is the triage state; the email is the conversation.
- **No team / project chrome.** The widget surfaces from the global header, the admin surface lives under `/admin/*`, not `/teams/*`.

### Data model

One model + two enums. Optional anchor FKs (`teamId` / `projectId` / `rehearsalId`) use `SetNull` so a deleted project/rehearsal doesn't cascade the report away — the row stays useful for triage even after the surface it referenced is gone. Mirrors the `ProjectResource.rehearsalId` convention; contrast with `Discussion`'s `Cascade` (a discussion is *about* the rehearsal; a feedback report is *not*).

| Model / Enum | Purpose |
|---|---|
| `Feedback` | One row per submission. `author` cascades from User; anchors `SetNull`. Indexes on `[status, createdAt]` (admin list) and `[authorUserId, createdAt]` (future "my feedback" page). |
| `FeedbackCategory` | `BUG \| IDEA \| QUESTION \| PRAISE`. |
| `FeedbackStatus` | `NEW \| TRIAGED \| IN_PROGRESS \| SHIPPED \| WONT_DO \| DUPLICATE`. Defaults `NEW`. |

The schema has an `appVersion: String?` column that is **not yet wired up** — see [docs/plans/feedback-followups.md](docs/plans/feedback-followups.md) for the resolution path (either wire to `VERCEL_GIT_COMMIT_SHA` or drop in a follow-up migration).

### Admin gating

[lib/auth/is-app-admin.ts](lib/auth/is-app-admin.ts) — `isAppAdmin(email)` reads the `ADMIN_EMAILS` env var (comma-separated, case-insensitive). Distinct from team-admin role. Trade-off vs. a `User.isAppAdmin` column: env is mutable without a migration, right shape while the admin count is one or two. Promote to a column when editing env on every change becomes friction.

[app/admin/layout.tsx](app/admin/layout.tsx) wraps every `/admin/*` route. Non-admins redirect to `/dashboard` rather than getting a 403 page — the surface is intentionally unlisted (no nav link, no breadcrumb, only reachable via direct URL or the email notification's deep-link).

### Files

| File | Responsibility |
|---|---|
| [lib/feedback/categories.ts](lib/feedback/categories.ts) | **Client-safe.** `FEEDBACK_CATEGORIES` const tuple, `FeedbackCategory` type, `FEEDBACK_CATEGORY_LABELS`, `FEEDBACK_CATEGORY_PROMPTS` (rotates the textarea placeholder by category), `FEEDBACK_CATEGORY_TOKENS` (maps each category to existing design-token groups — BUG → `--status-progress-*`, IDEA → primary teal, QUESTION → muted, PRAISE → `--note-voice-*`), `isFeedbackCategory` runtime guard, `FEEDBACK_BODY_MIN_LENGTH = 5`, `FEEDBACK_BODY_MAX_LENGTH = 2000`. Mirrors the literal Prisma enum (no Prisma import) — same pattern as `lib/notes/tags.ts`. |
| [lib/feedback/resolve-feedback-context.ts](lib/feedback/resolve-feedback-context.ts) | **Server-only.** Parses `pageUrl` and walks rehearsal → project → team / project → team / team → membership. Returns `{ teamId, projectId, rehearsalId }` only for IDs the viewer actually has access to. **Load-bearing**: never trust client-attached IDs — a compromised client could otherwise pin feedback to teams the user doesn't belong to (poisoning the admin inbox or the team's history). Same architectural pattern as `resolveCurrentTeamId`. |
| [lib/feedback/get-feedback-for-admin.ts](lib/feedback/get-feedback-for-admin.ts) | Admin list query, capped at 200, newest-first. No pagination in v1 — promote to cursor pagination if it grows hot. |
| [lib/feedback/get-feedback-by-id-for-admin.ts](lib/feedback/get-feedback-by-id-for-admin.ts) | Admin detail query. No team-membership check — the route is gated by the layout via `isAppAdmin`, which guarantees the caller can see anything in the table. Structurally different from the `get*ForUser()` family. |
| [app/feedback/feedback-actions.ts](app/feedback/feedback-actions.ts) | `submitFeedback` server action. Zod-validates, calls `resolveFeedbackContext`, inserts, fires admin email via `after()` so a Resend failure can't block the success state. |
| [app/admin/feedback/admin-feedback-actions.ts](app/admin/feedback/admin-feedback-actions.ts) | `updateFeedbackStatus`, `saveInternalNotes`, `respondToFeedback`. All gate through a single `requireAdmin()` helper (ensures `ADMIN_EMAILS` rotation doesn't need a sweep). Response action fires the email via `after()`. **Does not auto-advance status on reply** — operator might send "what did you mean by X?" without flipping to SHIPPED. |
| [lib/email/send.ts](lib/email/send.ts) | Extended with `sendFeedbackNotification` (to operator; `replyTo` = submitter so plain Reply works) and `sendFeedbackResponseEmail` (to submitter; quotes original message for context; ends with "Reply to this email if you'd like to continue"). |
| [components/feedback/feedback-launcher.tsx](components/feedback/feedback-launcher.tsx) | Server-gated entry mounted in [components/app-header.tsx](components/app-header.tsx). Returns `null` for signed-out users so the icon never appears on landing / auth / invite / privacy pages. |
| [components/feedback/feedback-launcher-client.tsx](components/feedback/feedback-launcher-client.tsx) | `MessageCircleQuestion` icon button between `ThemeToggle` and `UserButton`. Responsive Dialog (`≥ md`) vs. Vaul Drawer (mobile). Carries `data-onboarding-anchor="feedback-launcher"` for the dashboard tooltip pulse. |
| [components/feedback/feedback-form.tsx](components/feedback/feedback-form.tsx) | Shared body for Dialog and Drawer. Segmented 4-button category picker with per-category accent tints from existing tokens, category-aware textarea placeholder, char counter (visible at 1800), `Cmd/Ctrl+Enter` to send, transparent context-preview line ("We'll include the page you're on..."), and a success card ("Got it — Luis will see this within a day.") that auto-dismisses after 4s. The success card stays in the dialog rather than closing immediately + sonner-toasting — the warmer in-form confirmation is critical for sustained engagement in a beta. |
| [app/admin/feedback/page.tsx](app/admin/feedback/page.tsx) | Inbox list. Status filter pills (`ALL / NEW / TRIAGED / IN_PROGRESS / SHIPPED / WONT_DO / DUPLICATE`) with counts from a single `groupBy`. Rows: status + category chip + author + relative time + Replied indicator + body excerpt + page URL + breadcrumb. URL-synced via `?status=` (server-rendered Links, no client state). |
| [app/admin/feedback/[feedbackId]/page.tsx](app/admin/feedback/[feedbackId]/page.tsx) | Detail view: header (category + inline status dropdown + replied indicator), submitter mailto link, full message, context grid (page URL, linkable team/project/rehearsal, collapsible user-agent), internal notes scratchpad, reply form. |
| [app/admin/feedback/[feedbackId]/status-control.tsx](app/admin/feedback/[feedbackId]/status-control.tsx) | Radix Select dropdown for status changes; `useTransition` + sonner toast on success. |
| [app/admin/feedback/[feedbackId]/internal-notes-form.tsx](app/admin/feedback/[feedbackId]/internal-notes-form.tsx) | Scratchpad with explicit Save button + "Unsaved" indicator while dirty. Admin-only field; never displayed to submitters. |
| [app/admin/feedback/[feedbackId]/response-form.tsx](app/admin/feedback/[feedbackId]/response-form.tsx) | Reply composer. Detects "already replied" state (`previousResponse !== null`) and switches to amend mode with prior response pre-filled; button changes to "Send updated reply" so the operator knows the submitter gets a second email. |
| [app/admin/feedback/feedback-status-chip.tsx](app/admin/feedback/feedback-status-chip.tsx) | Status pill using existing design tokens. Exports `FEEDBACK_STATUS_LABELS`. |
| [app/admin/feedback/feedback-category-chip.tsx](app/admin/feedback/feedback-category-chip.tsx) | Category pill with icon + label, reusing `FEEDBACK_CATEGORY_TOKENS`. |

### Tooltip pulse for discovery

Single-step `TipSequence` mounted in [app/dashboard/page.tsx](app/dashboard/page.tsx) pointing at `[data-onboarding-anchor='feedback-launcher']`. Dashboard is the only signed-in surface every account visits early in its lifecycle. Uses the existing `feedback` tip-group key added to `TIP_GROUP_KEYS` in [lib/onboarding/state.ts](lib/onboarding/state.ts) — `parseOnboardingState`, `dismissTipGroup`, and `dismissTipGroupAction` all pick it up automatically with no new infrastructure. Existing users who completed the prior onboarding backfill will see this tip once on next dashboard visit (intentional — the feedback feature is new to them).

### Permissions

| Action | Operator (in `ADMIN_EMAILS`) | Any signed-in user | Signed-out |
|---|:---:|:---:|:---:|
| See feedback launcher in header | ✓ | ✓ | |
| Submit feedback | ✓ | ✓ | |
| Access `/admin/feedback` | ✓ | (redirect to /dashboard) | (redirect to sign-in) |
| Update status / notes / reply | ✓ | | |

### Privacy

The privacy page lists exactly what's collected on each submission (message, page URL, user-agent, name, email — nothing else) under "What we store" with a contact link for deletion requests. See [app/privacy/page.tsx](app/privacy/page.tsx). The wording follows the link-don't-paraphrase discipline — names the fields explicitly rather than hand-waving.

### Deferred (explicit non-goals for v1)

Listed in [docs/plans/feedback-followups.md](docs/plans/feedback-followups.md). Headline items: email-delivery failure detection (claimed-success-when-Resend-rejected), `appVersion` column wiring, "my feedback" page for submitters, status auto-advance on reply, rate limiting, screenshot attachments, public roadmap board.

## Privacy page (`/privacy`)

`/privacy` is the public-facing privacy policy and the canonical place where the beta's 18+ scope and "who sees what" model are explained. Unauthenticated users can land here directly — `proxy.ts` doesn't list `/privacy` under `isProtectedRoute`, so the route is open by design (privacy policies need to be readable without an account).

| File | Responsibility |
|---|---|
| [app/privacy/page.tsx](app/privacy/page.tsx) | Single-file server component. All sections (`Who Eight Count is for`, `What we store`, `What we won't do`, `What we might do`, `Visibility by role`, `Where your data lives`, `Your data, your control`, `Contact`) are inlined as `<Section>` calls in render order. Uses `RoleChip` to render the visibility table — keeps the public-facing role names visually consistent with the in-app chips. Two top-of-file constants are deployment touchpoints: `LAST_UPDATED` (bump whenever the policy text changes) and `CONTACT_EMAIL` (currently the owner's personal address; swap to a domain-hosted `privacy@` inbox once Eight Count has its own domain). |

**What's load-bearing here**:
- The "What we won't do" / "What we might do" pair is a deliberate split — it commits publicly to no-data-sale and no-AI-training-on-videos, while disclosing the *roadmap intent* to eventually train internal features (e.g. stalled-note prediction) on anonymized notes. Any change to model-training scope needs to be reflected here *before* shipping.
- The visibility table is the single source of truth users will reference for who-sees-what. If role permissions change in the data layer (e.g. a future "limited dancer" role, or scoping dancer visibility down to assigned-only notes), this table must be updated in lockstep with `ROLE_INFO` in [role-chip.tsx](app/teams/[teamId]/role-chip.tsx).
- The vendor list (Clerk, Google Cloud Storage, Neon, Resend) names every data processor. If a vendor is added, removed, or replaced, this list must be updated — both for trust signaling and because GDPR's processor-list rule applies if Eight Count ever sells into the EU.

**Linked from**: the landing page footer, the `BuiltForTrustSection` on the landing page, the hero's age-disclaimer line (`#who` deep-link), and the sign-up form's age disclaimer.

## Page Structure

Every page sits below a persistent global `<AppHeader>` (brand + team switcher when signed in + theme toggle + UserButton or sign-in/up buttons) — see "Global App Header & Team Switcher" above.

- `/` — Landing page. Warm hero with inline note mockup, problem section, three-step how-it-works, four-feature 2×2 grid, role row, final CTA. See "Landing Page UI" above.
- `/sign-in/[[...sign-in]]` — Headless sign-in. Split-screen layout (brand panel `hidden lg:flex`, form on the right). Email + password + Google OAuth + deep-link preservation via `?redirect_url=`. See "Auth UI" above.
- `/sign-up/[[...sign-up]]` — Headless sign-up. Two-step flow (create account → 6-digit email verification code). Reads `?email=` query param; when present, the email field is pre-filled and `readOnly` (used by the team-invitation flow to lock new accounts to the invited address). See "Auth UI" above.
- `/sign-in/sso-callback` — OAuth return handler. Renders `<AuthenticateWithRedirectCallback />` plus a centered loader.
- `/privacy` — Public privacy policy. Server-rendered, single-file (`app/privacy/page.tsx`). Sections: who Eight Count is for (beta + 18+), what we store, what we won't do, what we might do (with notice), visibility by role (uses `RoleChip` + a 4-row table), vendors (Clerk, Google Cloud Storage, Neon, Resend), data control + contact. Linked from the landing footer, the landing trust section, and the sign-up form's age disclaimer. See "Privacy page" above.
- `/invite/[token]` — Team invitation acceptance. Public route (not gated by `proxy.ts`). Server-rendered with one of: signed-out invite card (Create account / Sign in CTAs that preserve the invite URL via `?redirect_url=`), accept card (matching email), wrong-account card (mismatched email — sign out + retry), or info card (not found / expired / revoked / accepted). See "Team Invitations" above.
- `/dashboard` — Signed-in home. `DashboardMetaBand` ("Welcome back, {firstName}" + cross-team meta strip with a conditional "New replies" chip when there are unread comments) above `OnboardingChecklist`, `WorkTiles` (2-up "My notes" / "Notes by me" tiles with real metrics + a single `UnreadCommentsIndicator` line below the grid when the count > 0), and `TeamsSection`. Only page that aggregates across teams. Unread count comes from `getUnreadCommentCountForUser` — see "Note threads → Dashboard unread surfacing" above. See "Dashboard UI" and "Onboarding tour" below.
- `/teams/[teamId]` — Team organizational home. `TeamMetaBand` (breadcrumb, mark, title, role popover, desktop meta strip with Members / Projects / Created / role glance / Your role) above a single-column `TeamMobileTabs` shell that renders `<ProjectsSection />` + `<MembersSection />`. Mobile gets a `Projects (N) / Members (N)` segmented switcher. Header carries no CTAs — each section owns its action. Role chips are popover triggers for contextual role explanations. See "Team Page UI" below.
- `/projects/[projectId]` — Project home and structural bridge into the workspace. `ProjectMetaBand` (breadcrumb, title + status pill, meta chips, "Manage cast" / "New rehearsal") above an optional `RepeatingClustersCard` + optional `ProjectDrillSection` (per-dancer collapsible drill board) + a **`DiscussionsSection`** (text-only composer + project-level + rehearsal-rolled-up discussions, visible to all roles) + a two-column layout: rehearsals spine on the left (`RehearsalRow`s with date plate, status mini-bar, stalled chips) + a rail on the right stacking `ProjectGroupsSection` above `ProjectResourcesSection` (titled external links — production docs, refs — staff-write / everyone-read). On mobile a `ProjectMobileTabs` segmented switcher (`Rehearsals (N)` / `Groups (N)` / `Resources (N)`) toggles between the three so only one renders at a time. See "Project Page UI", "Project Resources", and "Drill surfaces" below.
- `/rehearsals/[rehearsalId]` — Rehearsal workspace. Page header is a `RehearsalContextBar` (breadcrumb / title / role / meta); body is a two-column workspace with the stage-plate video + density timeline on the left and a thread (progress spine, pill filters + assignee/tag dropdowns, note list with tag + repeating chips) on the right. Each `NoteRow` now carries a `ThreadAttachment` (collapsed-by-default thread + reactions + composer — see "Note threads" above). **Composer shape varies by viewport**: at `lg:+` it's a sticky card at the bottom of the right column; below `lg:` it's a peekable Vaul bottom sheet (80px peek + 280px expanded). The video pins to the top of the viewport on mobile via four contextual triggers — see "Mobile composer sheet" and "Contextual sticky video" under Rehearsal Workspace UI. Voice-note playback is video-synced. First-time note-authors see a 3-step `TipSequence` (timeline / composer / notes thread) once the video URL resolves — see "Onboarding tour" below.
- `/my-notes` — Recipient inbox / personal work queue. `SectionTabNav` + slim title bar + `Inbox / Drill view` toggle (URL-synced via `?view=drill`). **Inbox mode**: 2-column layout with sticky `QueueSummary` rail (240px on `lg+`, mobile-collapsing for From/Project/Tag/Type filters) + queue with an "Up next" hero (oldest unresolved note) and collapsible status groups. Each card uses an inline `StatusSegmented` radio control plus optional `TagChip` and `RepeatingChip` in the meta row, and carries a `ThreadAttachment` for the conversational layer. **Drill mode**: tag-grouped read-only checklist with `Recurring drills` header, auto-defaults the project filter to the busiest project for users in 2+ projects, and a Print button (`window.print()`). Threads are deliberately hidden in drill mode. First-time visitors in inbox mode with at least one assigned note see a 2-step `TipSequence` (Up-next hero / filter rail). See "My Notes UI" and "Drill surfaces" below.
- `/notes-by-me` — Author follow-through dashboard. `SectionTabNav` + slim title bar, then `AuthorSummaryStrip` (follow-through %, stalled, unassigned, plus a Repeating tile when any clusters exist) + `FilterSortBar` (Outstanding / Stalled / Complete / Unassigned / All; sort: Stalled first / Most recent / Oldest; tag-filter row when any tagged notes exist) + a list of `AuthoredNoteCard`s (with `TagChip` in the meta row) with per-recipient pip rows (with a small `Repeat` decoration on pips that are part of a cluster). Each card carries a `ThreadAttachment` so authors can read and reply to recipient questions inline. Stalled is computed server-side via [lib/notes/stalled.ts](lib/notes/stalled.ts) (`createdAt` older than 3 days AND any active assignment); repeating clusters via [lib/notes/repeating.ts](lib/notes/repeating.ts). See "Notes By Me UI" and "Repeating-correction detection" above.

## Key Conventions

**Imports**: `@/*` resolves to the repo root. Always use absolute imports (`@/lib/db`, `@/components/ui/button`). Prisma types: `import type { X } from "@/generated/prisma/client"`. Never instantiate `PrismaClient` directly — import `db` from [lib/db.ts](lib/db.ts).

**Types**: Co-locate in a `types.ts` within the feature directory. Map Prisma results to explicit UI types rather than leaking Prisma types into components.

**Components**: Server components fetch their own data (no prop drilling). Client components are marked `"use client"`. Shared components live in `components/`; feature-specific ones live next to their page.

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
```

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — Pooled PostgreSQL connection string
- `DIRECT_URL` — Direct (non-pooled) connection for Prisma migrations
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Clerk routing: `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- GCS: `GCS_BUCKET_NAME`, `GOOGLE_CLOUD_PROJECT_ID`, plus service account credentials
- Email (team invitations): `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` (absolute URL the invite-acceptance link is built from — e.g. `http://localhost:3000` locally, the deployed origin in prod), and optional `EMAIL_FROM` (e.g. `Eight Count <invites@yourdomain.com>`). Falls back to `Eight Count <onboarding@resend.dev>` which Resend only delivers to your own account email — verify a domain in Resend before inviting non-self addresses.
- Transcription: `DEEPGRAM_API_KEY` (required for voice-note transcription) and optional `DEEPGRAM_MODEL` (defaults to `nova-3`). When unset, voice-note rows mark `transcriptStatus = FAILED` instead of crashing — production deployments should always set it; the route logs a loud `[transcription]` error if missing in `NODE_ENV=production`. See "Voice Note Transcription" below.

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
  ↓       ↓             ↓
TeamMember  ProjectGroup  AudioAsset[]   (one per voice note)
  ↑                       ↓
TeamInvitation            Note → NoteTarget[]
                            ↓
                          NoteAssignment → NoteAssignmentStatus
```

- **Teams** have members with roles: `ADMIN | INSTRUCTOR | ASSISTANT | DANCER`
- **TeamInvitations** sit alongside `TeamMember` and represent pending or historical email invites. Status: `PENDING | ACCEPTED | REVOKED | EXPIRED`. Accepting an invitation creates a `TeamMember` row; the invitation row stays as a record. See "Team Invitations" below.
- **Notes** carry an optional `tag: NoteTag?` (`TIMING | SPACING | ENERGY | MUSICALITY | FORMATION | TECHNIQUE`). Tags are global enum values, optional, and apply uniformly to TEXT and VOICE notes. See "Note Tags" and "Repeating-correction detection" below.
- **Projects** belong to a team and can have **ProjectGroups** (e.g., "Front line")
- **Rehearsals** belong to a project and have one optional `VideoAsset`, many `AudioAsset`s (one per voice note), and many `Note`s
- **AudioAssets** carry transcript state alongside upload state: `transcript`, `transcriptStatus: TranscriptStatus` (`PENDING | PROCESSING | READY | FAILED`), `transcriptError`, `transcribedAt`. See "Voice Note Transcription" below.
- **Notes** are either `TEXT` or `VOICE` (`Note.noteType`). They share targeting/assignment/status pipelines (see below)

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

### Repeating-correction detection

A "repeating cluster" exists when the **same dancer** has **≥3 active assignments** (status OPEN or IN_PROGRESS) with the **same tag** in the **same project**. Threshold and rule live in [lib/notes/repeating.ts](lib/notes/repeating.ts) as `REPEATING_THRESHOLD = 3`.

- **Pure derivation** — no new tables. `detectRepeatingClusters(assignments)` groups active assignments by `(projectId, userId, tag)` and returns groups meeting the threshold. Mirrors the [stalled.ts](lib/notes/stalled.ts) pattern.
- **Project-scoped** — cross-project clustering would surface stale signals from past shows. Same-tag notes from different projects don't combine.
- **Helpers**: `buildRepeatingMarkerByAssignmentId(clusters)` produces a `Map<assignmentId, { tag, count }>` for O(1) lookup when rendering rows; `indexClustersByUserAndTag(clusters)` powers the drill board's per-dancer per-tag grouping.
- **Server-side query**: [lib/notes/get-active-assignments-for-project.ts](lib/notes/get-active-assignments-for-project.ts) returns assignments with status absent OR `OPEN` OR `IN_PROGRESS` for the given projects, with the `note.tag` and user info needed for cluster detection. Called once per request from `/my-notes`, `/notes-by-me`, the project page, and the rehearsal workspace page.
- **Display**: [components/repeating-chip.tsx](components/repeating-chip.tsx) — token-tinted (`--repeating-{bg,fg,border}`, plum/violet hue ~285) chip with the `Repeat` icon. `compact` mode shows only `Repeating × 3` (used inline next to a `StatusChip`); full mode shows `Repeating · Timing × 3`.

**Surfacing rules**:
- Workspace `NoteRow` — per-recipient chip in compact mode next to the `StatusChip` (a single note can be repeating for one recipient, not for another).
- `/my-notes` `AssignedNoteCard` — full chip in the top meta row when this user's assignment is in a cluster.
- `/notes-by-me` `RecipientPipRow` — small `Repeat` icon decoration next to the per-pip status dot. (`/notes-by-me` is staff-only by virtue of being the author dashboard.)
- `/notes-by-me` `AuthorSummaryStrip` — fourth metric tile "Repeating: N dancers" only renders when N > 0; the strip's grid switches from 3-col to 4-col when shown.
- Project page `RepeatingClustersCard` — **staff-only** (Admin / Instructor / Assistant). Surfaces every dancer's cluster by name, which concentrates per-dancer struggle data in a way meant for instructors, not peers. Dancers don't see this card on the project page; their personal repeating-cluster signals still surface on `/my-notes` cards via the `RepeatingChip` and on the drill view's "Recurring drills" header.

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
| [components/theme-provider.tsx](components/theme-provider.tsx) | Wraps `next-themes`'s provider plus a `<ThemeHotkey>` listener that toggles light↔dark on `D` keypress. The handler bails on `isTypingTarget(target)` (input/textarea/contenteditable/select) **before** calling `event.key.toLowerCase()`, plus guards `typeof event.key !== "string"` — third-party scripts (notably Clerk's CAPTCHA) can fire synthetic keyboard events without a `key` field, and the original implementation crashed on those. |
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

Enforce via `TeamMember.role` after fetching with a `get*ForUser()` function.

## Server Actions

Action files live alongside their route pages:

| File | Exports |
|------|---------|
| `app/dashboard/actions.ts` | `createTeam()` |
| `app/teams/[teamId]/actions.ts` | `createProject()` |
| `app/teams/[teamId]/member-actions.ts` | `inviteTeamMember()`, `revokeInvitation()`, `resendInvitation()` |
| `app/projects/[projectId]/actions.ts` | `createRehearsal()` |
| `app/projects/[projectId]/group-actions.ts` | `createProjectGroup()`, `updateProjectGroupMembers()`, `deleteProjectGroup()` |
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
- `POST /api/rehearsals/[rehearsalId]/video/upload-url` — generate GCS signed upload URL for video (staff roles only; mp4 / mov / webm)
- `POST /api/video-assets/[videoAssetId]/complete` — mark video upload complete (**uploader-only**: caller must equal `videoAsset.uploadedByUserId`)
- `GET /api/rehearsals/[rehearsalId]/video/playback-url` — get signed video playback URL (1-hr expiry)
- `POST /api/rehearsals/[rehearsalId]/audio/upload-url` — generate GCS signed upload URL for a voice-note audio asset (staff roles only; 25 MB cap; webm/mp4/ogg/mpeg)
- `POST /api/audio-assets/[audioAssetId]/complete` — mark audio upload complete and store `durationMs` (**uploader-only**: caller must equal `audioAsset.uploadedByUserId`). Also kicks off Deepgram transcription via `after()` — see "Voice Note Transcription" below.
- `GET /api/audio-assets/[audioAssetId]/playback-url` — get signed audio playback URL (1-hr expiry); fetched lazily on first play
- `GET /api/audio-assets/[audioAssetId]/transcript` — get current transcript state (`status`, `transcript`, `transcriptError`) for polling. Auth: any team member of the owning team.
- `POST /api/audio-assets/[audioAssetId]/transcript/retry` — re-trigger transcription for a `FAILED` (or any) row. **Staff-only** (ADMIN / INSTRUCTOR / ASSISTANT). Resets row to `PENDING` and fires a fresh `after(() => runTranscription(...))`.
- `POST /api/invitations/[token]/accept` — accept a team invitation. Auth-gated, status-gated, **email-match-gated** (signed-in user's email must equal the invitation's email). Idempotent on the `TeamMember` row. Returns `{ teamId, teamName }` for the client to redirect into. See "Team Invitations" above.

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
| [app/api/audio-assets/[audioAssetId]/transcript/retry/route.ts](app/api/audio-assets/[audioAssetId]/transcript/retry/route.ts) | `POST` for staff retry. Auth: ADMIN / INSTRUCTOR / ASSISTANT only. Resets row to `PENDING`, fires `after(() => runTranscription(...))` again. `maxDuration = 60`. |

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
| [rehearsal-context-bar.tsx](app/rehearsals/[rehearsalId]/rehearsal-context-bar.tsx) | Page header: breadcrumb (team → project → rehearsal), title, role pill, meta row. Edge-to-edge background with `mx-auto max-w-7xl` content wrapper to align with the workspace below. Accepts an optional `actions` slot rendered on the right side of the title row — used for rehearsal-level actions like Replace video. |
| [rehearsal-actions-menu.tsx](app/rehearsals/[rehearsalId]/rehearsal-actions-menu.tsx) | Staff-only overflow `…` menu rendered into the context bar's `actions` slot when a video exists. Currently has a single **Replace video** item that opens a `<Dialog>` containing the upload form. Designed to extend with future rehearsal-level actions (delete, archive, share). |
| [workspace/rehearsal-workspace.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-workspace.tsx) | Orchestrator. Owns `videoRef`, `timelineRef`, scrubbing pointer state, playback-URL fetch, audience selection, edit-modal state. Layout: `lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]` with sticky-top left rail and sticky-bottom composer in the right column. |
| [workspace/rehearsal-video-card.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-video-card.tsx) | Dark "stage plate" wrapping `<video>` with no native `controls`, custom transport (play / pause + ±5s + mono time), and on-frame overlay pills (file watermark, time pill, center play button when paused). `isPlaying` is tracked locally via the audio element's `onPlay`/`onPause`/`onEnded` events. |
| [workspace/rehearsal-timeline-card.tsx](app/rehearsals/[rehearsalId]/workspace/rehearsal-timeline-card.tsx) | Separate card with a 48-bucket density strip, scrubbable track, voice/text colored markers, playhead, and 5 evenly-spaced time ticks. Density bars are absolutely positioned (not flex) so they share the same `0–100%` coordinate system as the markers. |
| [workspace/notes-summary.tsx](app/rehearsals/[rehearsalId]/workspace/notes-summary.tsx) | "Progress spine" — aggregates `NoteAssignment` statuses across all notes (not per-note) into a four-segment stacked bar. Returns `null` when there are no assignments. |
| [workspace/notes-list-card.tsx](app/rehearsals/[rehearsalId]/workspace/notes-list-card.tsx) | Filter pill row (`ALL / OPEN / IN_PROGRESS / ADDRESSED / RESOLVED / UNASSIGNED / VOICE / MINE`) + assignee dropdown + tag dropdown (only shown when at least one tagged note exists) + thread of `NoteRow`s. `NoteRow` shows a `TagChip` next to the author name when the note has a tag, and a compact `RepeatingChip` next to each `StatusChip` for assignments that are part of a repeating cluster. Pills show precomputed counts; status filters match notes that have *any* assignment with the given status. |
| [workspace/add-note-card.tsx](app/rehearsals/[rehearsalId]/workspace/add-note-card.tsx) | Sticky composer. Sub-bar with mode tabs, audience popover (wraps the existing `AudiencePicker`), a [TagPicker](app/rehearsals/[rehearsalId]/workspace/tag-picker.tsx) for the optional note tag, and a locked-timestamp pill that re-captures the current playhead on click. |
| [workspace/audience-picker.tsx](app/rehearsals/[rehearsalId]/workspace/audience-picker.tsx) | Combobox-style picker (full-cast quick action, groups, individuals). Now rendered inside the composer's audience popover and inside `EditNoteSheet`. |
| [workspace/tag-picker.tsx](app/rehearsals/[rehearsalId]/workspace/tag-picker.tsx) | Single-select Radix Popover for the optional `NoteTag` enum. See "Note Tags" above. |
| [workspace/status-chip.tsx](app/rehearsals/[rehearsalId]/workspace/status-chip.tsx) | Per-recipient status chip (`name + 7px dot + status label`). Capped at `max-w-full` with `min-w-0 truncate` on the label and `shrink-0` on the dot/status word, so long names or emails truncate with `…` instead of overflowing the parent card; full label is exposed via `title=` for hover/long-press. Exports `StatusDot` for reuse (used by `notes-summary.tsx`). |

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

### `/my-notes` Drill view

A view-mode toggle at the top of `/my-notes` flips between **Inbox** (default) and **Drill view**. Persisted in the URL as `?view=drill` so it's bookmarkable but not stored server-side.

| File | Responsibility |
|---|---|
| [app/my-notes/drill-view.tsx](app/my-notes/drill-view.tsx) | Tag-grouped checklist. Top "Recurring drills" section surfaces clusters; tag sections render in fixed order (TIMING → SPACING → ENERGY → MUSICALITY → FORMATION → TECHNIQUE → Other). Each row is read-only: optional project chip (when 2+ projects active) + rehearsal title link + timestamp + clamped body or voice-note placeholder + status dot. "Print" button calls `window.print()`. Optional `singleProjectHeader` prop renders a "Showing N notes from X · See all projects" banner when filtered. |
| [app/my-notes/my-notes-list.tsx](app/my-notes/my-notes-list.tsx) | Owns the toggle. Computes `activeProjects` (sorted by openCount desc) once. Lazy-initializes the project filter to the busiest active project on entering drill mode (deep-link case via `useState` initializer; click-toggle case in `setViewMode`). Threads `showProjectInRows` and `singleProjectHeader` props to `DrillView`. Tour gating uses `viewMode === "inbox"` so the tip sequence skips while in drill mode (anchors are absent). |

**Auto-default rule**: when the user has open + in-progress notes in **2+ projects**, the project filter pre-applies to the project with the most open notes. The `SingleProjectHeader` button "See all projects" clears just the project filter. If the user clears the filter and re-enters drill mode, they get auto-defaulted again — accepted trade-off vs. tracking explicit-clear state through React Compiler's "no setState in effect" rule.

**Project chip on rows**: each drill row shows its project title as a small muted chip when the user has notes in 2+ projects (so they always know what show they're drilling). Hidden when there's no ambiguity.

### Project-page drill surfaces

`/projects/[projectId]` adds two sibling cards between the meta band and `RehearsalsSection`, both backed by the same `getActiveAssignmentsForProjects` query. **Both are staff-only** — gated behind `isStaff = role === "ADMIN" || role === "INSTRUCTOR" || role === "ASSISTANT"`. Dancers don't see the project drill board or the repeating-clusters card; their personal drill view at `/my-notes?view=drill` is the dancer-side alternative, scoped to their own notes.

The "Manage cast" button in the project meta band's `actions` slot is also staff-only — for dancers, it would link to a team page they can only read, so it's hidden rather than rendered as a misleading CTA.

| File | Responsibility |
|---|---|
| [app/projects/[projectId]/repeating-clusters-card.tsx](app/projects/[projectId]/repeating-clusters-card.tsx) | Compact summary card. One row per cluster: avatar + dancer name + tag chip + "N unresolved". Hides when `clusters.length === 0`. Uses the `--repeating-*` tokens for surface tinting. |
| [app/projects/[projectId]/project-drill-section.tsx](app/projects/[projectId]/project-drill-section.tsx) | Per-dancer collapsible drill board. Default expansion is the viewer's own row when they're a recipient, otherwise the dancer with the most clusters. Within each dancer, tag buckets sort: repeating clusters first, then by item count, then canonical tag order, then untagged ("Other") last. Each item is a read-only `DrillRow` from `components/drill/`. Hides when no active assignments exist in the project. |

### Print stylesheet

`@media print` block in [app/globals.css](app/globals.css), **scoped to `body[data-print-target="drill"]`**. The `DrillView` component sets `document.body.dataset.printTarget = "drill"` in a `useEffect` while mounted and clears it on unmount, so accidentally printing any other page (Cmd+P on a rehearsal page, etc.) gets a normal browser-default print, not the drill-formatted layout.

While the drill view is mounted:
- Hides `header, nav, [data-print-hidden]`; reveals `[data-print-only]`.
- Forces white surfaces on the body for ink economy.
- `break-inside: avoid` on `.drill-tag-section` and `.drill-row` so dancer/tag groups don't split across pages.
- `.tag-chip` switches to outlined (currentColor border, transparent bg) for B&W printability.

### What's deliberately deferred

- Dedicated `/projects/[id]/drill-list` sub-route with shareable `?dancer=USER_ID` URLs.
- Whole-company print sheets (instructor printing all dancers in one document).
- PDF export endpoint — `window.print()` → "Save as PDF" is sufficient for v1.
- Curated "tonight's drill list" entity (`DrillSheet` + `DrillSheetItem`) for hand-picked subsets.
- Per-tag color coding — single neutral chip in v1.
- Multi-tag per note — single tag column.
- Cross-project repeating detection — project-scoped only.

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

`/projects/[projectId]` is a structural bridge into the rehearsal workspace — a lighter-weight page that orients the user (which project, what state, what's next) and surfaces rehearsals as the primary object. Desktop is a two-column shell (rehearsal spine + groups rail). On mobile, a segmented tab switcher toggles between **Rehearsals** and **Groups** so the user can focus on one at a time.

| File | Responsibility |
|---|---|
| [app/projects/[projectId]/page.tsx](app/projects/[projectId]/page.tsx) | Server entry. Fetches the project, rehearsals (with notes/assignments/authors/video duration), groups, and team members in parallel. Aggregates per-rehearsal totals (text/voice counts, assignment status counts, distinct contributors, stalled count via [`isNoteStalled`](lib/notes/stalled.ts)) and project-wide totals (rehearsal count, cast count, open notes, distinct contributors). Also runs `getActiveAssignmentsForProjects` + `detectRepeatingClusters` to build per-dancer drill recipients and cluster summaries. Renders `<ProjectMetaBand />` above `<RepeatingClustersCard />` + `<ProjectDrillSection />` + `<ProjectMobileTabs>` which slots `<RehearsalsSection />` + `<ProjectGroupsSection />`. |
| [repeating-clusters-card.tsx](app/projects/[projectId]/repeating-clusters-card.tsx) | Tinted summary card listing active repeating clusters one row at a time. **Staff-only** — gated on `isStaff` in the page entry. See "Drill surfaces" above. |
| [project-drill-section.tsx](app/projects/[projectId]/project-drill-section.tsx) | Per-dancer collapsible drill board for the project. **Staff-only** — gated on `isStaff` in the page entry. See "Drill surfaces" above. |
| [project-meta-band.tsx](app/projects/[projectId]/project-meta-band.tsx) | Edge-to-edge `bg-card` band. Breadcrumb (Dashboard › team › project), title + `ProjectStatusPill` + `RolePill`, optional description, actions slot, and a meta strip with `MetaChip`s (Rehearsals / Cast / Open notes). On mobile the meta strip flattens into compact `[icon] {value} {label}` chips on a single line, the description is `line-clamp-2`, the title shrinks to `text-xl`, the breadcrumb's "Dashboard" segment is hidden, and the contributor `AvatarStack` is hidden. On `sm:+` it gains the eyebrow + `border-t` divider + accent suffix + the contributor stack. |
| [project-mobile-tabs.tsx](app/projects/[projectId]/project-mobile-tabs.tsx) | Client wrapper. Renders a segmented `role="tablist"` (`Rehearsals (N)` / `Groups (N)`) visible only below `lg:`, plus the `lg:grid-cols-[minmax(0,1fr)_320px]` two-column layout. On mobile the inactive panel gets `hidden lg:flex`; on `lg:+` the override always wins so both panels render together. Default tab on mobile is Rehearsals. |
| [rehearsals-section.tsx](app/projects/[projectId]/rehearsals-section.tsx) | Heading + helper line + list of `RehearsalRow`s, OR a generous empty-state panel guiding staff to create the first rehearsal (gated on `canManage`). |
| [rehearsal-row.tsx](app/projects/[projectId]/rehearsal-row.tsx) | Per-rehearsal `<Link>` row into `/rehearsals/[id]`. CSS-grid layout on `md:+` (date plate / body / progress / chev) collapsing to a single column on mobile. Left accent stripe is teal for the **current** rehearsal and neutral otherwise. Body shows duration (or "No video yet"), total notes (with coral voice-note tally), small contributor stack, relative date, and a `Clock + N stalled` chip when applicable. Progress block uses `NoteProgressBar` with `closed/total · pct%` plus an "All notes resolved" badge or `n open · n working · n done` caption. |
| [project-groups-section.tsx](app/projects/[projectId]/project-groups-section.tsx) | Compact rail card. Heading + slim `+ New` button → optional inline `CreateGroupForm` → single-column list of `GroupCard`s. Each `GroupCard` shows the name, an "empty" pill tinted with the in-progress palette when membership is zero, an icon-only edit/delete pair (gated on `canManage`), and either an inline "Add members" CTA or a flex-wrapping pill list with `AvatarInitials` + name. CRUD pipeline (`createProjectGroup`, `updateProjectGroupMembers`, `deleteProjectGroup`) is unchanged. |
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
| [components/team-switcher.tsx](components/team-switcher.tsx) | **Client component**. Radix `<Popover>` trigger (avatar + truncated team name + role chip + chevron) → list of all teams the user belongs to (each row uses `<AvatarInitials toneSeed={team.id}>` + `<RoleChip>`, current team gets a check) → "+ Create team" footer that opens a `<Dialog>` wrapping the chromeless `CreateTeamForm`. Trigger truncates at `max-w-56`; role chip hides below `sm:`. |
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
| [components/repeating-chip.tsx](components/repeating-chip.tsx) | Plum-tinted chip (`--repeating-*`) with `Repeat` icon. `compact` mode shows `Repeating × 3`; default mode shows `Repeating · Timing × 3`. |
| [lib/notes/format.ts](lib/notes/format.ts) | `formatNoteTimestamp(ms)` — single source of truth for `mm:ss` rendering across the app. The workspace's `./utils.ts` re-exports this as `formatTimestamp` so its many existing imports keep working. |
| [lib/notes/stalled.ts](lib/notes/stalled.ts) | `isNoteStalled({ createdAt, assignments, now })` + `STALLED_THRESHOLD_DAYS = 3`. Pure, server- and client-safe; `now` is injectable so it's deterministic in tests. |
| [lib/notes/tags.ts](lib/notes/tags.ts) | `NOTE_TAGS` const tuple, `NoteTag` type, `NOTE_TAG_LABELS`, `NOTE_TAG_DESCRIPTIONS`, `isNoteTag` runtime guard. Mirrors the Prisma enum literally (no Prisma import) so the module stays client-safe. |
| [lib/notes/repeating.ts](lib/notes/repeating.ts) | `detectRepeatingClusters`, `buildRepeatingMarkerByAssignmentId`, `indexClustersByUserAndTag`, `REPEATING_THRESHOLD = 3`. Pure derivation. See "Repeating-correction detection" above. |
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
- `/dashboard` — Signed-in home. `DashboardMetaBand` ("Welcome back, {firstName}" + cross-team meta strip) above `OnboardingChecklist` (dismissible role-gated tour for new users), `WorkTiles` (2-up "My notes" / "Notes by me" tiles with real metrics), and `TeamsSection` (compact team rows with role chip + activity meta + `+ New team` button, or generous empty-state CTA). Only page that aggregates across teams. See "Dashboard UI" and "Onboarding tour" below.
- `/teams/[teamId]` — Team organizational home. `TeamMetaBand` (breadcrumb, mark, title, role popover, desktop meta strip with Members / Projects / Created / role glance / Your role) above a single-column `TeamMobileTabs` shell that renders `<ProjectsSection />` + `<MembersSection />`. Mobile gets a `Projects (N) / Members (N)` segmented switcher. Header carries no CTAs — each section owns its action. Role chips are popover triggers for contextual role explanations. See "Team Page UI" below.
- `/projects/[projectId]` — Project home and structural bridge into the workspace. `ProjectMetaBand` (breadcrumb, title + status pill, meta chips, "Manage cast" / "New rehearsal") above an optional `RepeatingClustersCard` + optional `ProjectDrillSection` (per-dancer collapsible drill board) + a two-column layout: rehearsals spine on the left (`RehearsalRow`s with date plate, status mini-bar, stalled chips) + a compact `ProjectGroupsSection` rail on the right. On mobile a `ProjectMobileTabs` segmented switcher (`Rehearsals (N)` / `Groups (N)`) toggles between the two so only one renders at a time. See "Project Page UI" and "Drill surfaces" below.
- `/rehearsals/[rehearsalId]` — Rehearsal workspace. Page header is a `RehearsalContextBar` (breadcrumb / title / role / meta); body is a sticky two-column workspace with the stage-plate video + density timeline on the left and a thread (progress spine, pill filters + assignee/tag dropdowns, note list with tag + repeating chips, sticky composer with `TagPicker`) on the right. Voice-note playback is video-synced here. First-time note-authors see a 3-step `TipSequence` (timeline / composer / notes thread) once the video URL resolves — see "Onboarding tour" below. See "Rehearsal Workspace UI" above.
- `/my-notes` — Recipient inbox / personal work queue. `SectionTabNav` + slim title bar + `Inbox / Drill view` toggle (URL-synced via `?view=drill`). **Inbox mode**: 2-column layout with sticky `QueueSummary` rail (240px on `lg+`, mobile-collapsing for From/Project/Tag/Type filters) + queue with an "Up next" hero (oldest unresolved note) and collapsible status groups. Each card uses an inline `StatusSegmented` radio control plus optional `TagChip` and `RepeatingChip` in the meta row. **Drill mode**: tag-grouped read-only checklist with `Recurring drills` header, auto-defaults the project filter to the busiest project for users in 2+ projects, and a Print button (`window.print()`). First-time visitors in inbox mode with at least one assigned note see a 2-step `TipSequence` (Up-next hero / filter rail). See "My Notes UI" and "Drill surfaces" below.
- `/notes-by-me` — Author follow-through dashboard. `SectionTabNav` + slim title bar, then `AuthorSummaryStrip` (follow-through %, stalled, unassigned, plus a Repeating tile when any clusters exist) + `FilterSortBar` (Outstanding / Stalled / Complete / Unassigned / All; sort: Stalled first / Most recent / Oldest; tag-filter row when any tagged notes exist) + a list of `AuthoredNoteCard`s (with `TagChip` in the meta row) with per-recipient pip rows (with a small `Repeat` decoration on pips that are part of a cluster). Stalled is computed server-side via [lib/notes/stalled.ts](lib/notes/stalled.ts) (`createdAt` older than 3 days AND any active assignment); repeating clusters via [lib/notes/repeating.ts](lib/notes/repeating.ts). See "Notes By Me UI" and "Repeating-correction detection" above.

## Key Conventions

**Imports**: `@/*` resolves to the repo root. Always use absolute imports (`@/lib/db`, `@/components/ui/button`). Prisma types: `import type { X } from "@/generated/prisma/client"`. Never instantiate `PrismaClient` directly — import `db` from [lib/db.ts](lib/db.ts).

**Types**: Co-locate in a `types.ts` within the feature directory. Map Prisma results to explicit UI types rather than leaking Prisma types into components.

**Components**: Server components fetch their own data (no prop drilling). Client components are marked `"use client"`. Shared components live in `components/`; feature-specific ones live next to their page.

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
  ↓       ↓                      ↓
TeamMember  ProjectGroup        Note → NoteTarget[]
                                    ↓
                               NoteAssignment → NoteAssignmentStatus
```

- **Teams** have members with roles: `ADMIN | INSTRUCTOR | ASSISTANT | DANCER`
- **Projects** belong to a team and can have **ProjectGroups** (e.g., "Front line")
- **Rehearsals** belong to a project and have one optional `VideoAsset` and many `Note`s
- **Notes** use a dual targeting model (see below)

### Note Targeting System

Notes separate *audience intent* from *individual tracking*:

1. **`NoteTarget`** — the original audience (e.g., `EVERYONE`, a `GROUP`, or a specific `USER`)
2. **`NoteAssignment`** — one row per resolved recipient, each with independent status

Resolution: `EVERYONE` → all team members; `GROUP` → all group members; `USER` → that user. Multiple targets deduplicate by userId. See [app/api/rehearsals/[rehearsalId]/notes/route.ts](app/api/rehearsals/[rehearsalId]/notes/route.ts).

**Status storage**: `NoteAssignment` has no status field. Status lives in a separate optional `NoteAssignmentStatus` model (1:1 via `noteAssignmentId`). Absence of a row implies `OPEN`. Always update via upsert. Use `isActiveStatus(status)` from [lib/notes/statuses.ts](lib/notes/statuses.ts) to check if a status is `OPEN` or `IN_PROGRESS`.

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
| Create rehearsals / upload video / author notes | ✓ | ✓ | ✓ | |
| Update their own note status | ✓ | ✓ | ✓ | ✓ |

Enforce via `TeamMember.role` after fetching with a `get*ForUser()` function.

## Server Actions

Located in `actions.ts` (and `group-actions.ts`) alongside their route pages:

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
- `POST /api/rehearsals/[rehearsalId]/notes` — create note with targets + assignments
- `POST /api/rehearsals/[rehearsalId]/video/upload-url` — generate GCS signed upload URL
- `POST /api/video-assets/[videoAssetId]/complete` — mark upload complete
- `GET /api/rehearsals/[rehearsalId]/video/playback-url` — get signed playback URL (1-hr expiry)

Request/response types: [lib/api/contracts.ts](lib/api/contracts.ts) and [lib/api/responses.ts](lib/api/responses.ts).

## Video Upload Flow

1. Client POSTs to `/upload-url` → server creates `VideoAsset` (`UPLOADING`) and returns GCS signed URL
2. Client uploads file directly to GCS
3. Client POSTs to `/complete` with duration → server sets status to `READY`

GCS path: `teams/{teamId}/projects/{projectId}/rehearsals/{rehearsalId}/video/{videoAssetId}-{filename}`

## Page Structure

- `/` — Landing (unauthenticated)
- `/dashboard` — Team list + create team
- `/teams/[teamId]` — Team overview, member management
- `/projects/[projectId]` — Project details, rehearsal list, group management
- `/rehearsals/[rehearsalId]` — Rehearsal overview, video upload
- `/rehearsals/[rehearsalId]/workspace` — Main workspace (video + notes)
- `/my-notes` — Dancer inbox: all notes assigned to current user
- `/notes-by-me` — Author view: all notes the current user created

## Key Conventions

**Imports**: `@/*` resolves to the repo root. Always use absolute imports (`@/lib/db`, `@/components/ui/button`). Prisma types: `import type { X } from "@/generated/prisma/client"`. Never instantiate `PrismaClient` directly — import `db` from [lib/db.ts](lib/db.ts).

**Types**: Co-locate in a `types.ts` within the feature directory. Map Prisma results to explicit UI types rather than leaking Prisma types into components.

**Components**: Server components fetch their own data (no prop drilling). Client components are marked `"use client"`. Shared components live in `components/`; feature-specific ones live next to their page.

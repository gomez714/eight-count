# Implementation Plan: Note Tags + Repeated-Correction Detection + Drill Surfaces

Three coordinated additions:
1. **Note tags** — author-set, optional, from a fixed enum.
2. **Repeated-correction detection** — derived signal, surfaced where authors and dancers live.
3. **Drill surfaces** — *not* a dedicated page in v1. Instead: a tag-grouped **print mode** on `/my-notes` + a per-dancer **drill section** on the project page. Dedicated drill route deferred until usage data justifies it.

---

## 0. Locked decisions

| # | Decision | Notes |
|---|---|---|
| 1 | Single tag per note | One nullable `tag` column on `Note`. Multi-tag deferred. |
| 2 | Six tags: **TIMING, SPACING, ENERGY, MUSICALITY, FORMATION, TECHNIQUE** | TEXTURE dropped (overlaps ENERGY/MUSICALITY). |
| 3 | Tags optional everywhere | No required-tag setting. Untagged notes simply don't participate in repeating detection. |
| 4 | Repeating threshold = **3** active assignments, project-scoped | Constant `REPEATING_THRESHOLD = 3` in `lib/notes/repeating.ts`. ADDRESSED/RESOLVED don't count. Cross-project surfacing deferred. |
| 5 | Surface repeating in: `/my-notes`, `/notes-by-me`, project-page summary card | Computed once per request server-side; same pattern as stalled. |
| 6 | Single neutral tag chip; no per-tag palette | Uses `--muted` / `--muted-foreground`. Per-tag icons revisited only if scannability becomes a complaint. |
| 7 | **No dedicated drill list page in v1.** Drill capability ships as: (a) tag filter + "Print view" toggle on `/my-notes` for dancers, and (b) a per-dancer drill section on `/projects/[projectId]` for instructors. | Dedicated route `/projects/[id]/drill-list` deferred. Revisit if users ask for shareable URLs or whole-company print sheets. |
| 8 | Project-page drill section is viewer-aware | Default expansion: dancers see their own row first; instructors see all dancers, sorted by repeating-cluster count then alphabetical. |
| 9 | CSS print stylesheet only | Applies to the `/my-notes` print mode. No PDF endpoint. |
| 10 | All drill surfaces are read-only | Updated indirectly through normal note flows (create/edit/status). No duplicate mutation surfaces. |

---

## 1. Schema + migration

### Schema changes (`prisma/schema.prisma`)

Add a `NoteTag` enum and a nullable `tag` field on `Note`:

```prisma
enum NoteTag {
  TIMING
  SPACING
  ENERGY
  MUSICALITY
  FORMATION
  TECHNIQUE
}

model Note {
  // ... existing fields
  tag NoteTag?

  // ... existing relations + indexes
  @@index([tag])  // supports the repeating-detection query
}
```

The `@@index([tag])` matters: the repeating-detection query filters by `tag` after joining through assignments and project, so a btree index on `tag` shaves the filter cost. Combined with the existing `@@index([rehearsalId])` on `Note` and `@@index([userId])` on `NoteAssignment`, the query plan is already good.

### Migration

```bash
npx prisma migrate dev --name add_note_tag
```

Single additive migration. No backfill needed — null is a valid state.

Run `npx prisma generate` after.

---

## 2. Type + utility layer

### `lib/notes/tags.ts` (new)

The single source of truth for tag vocabulary, mirroring how `lib/notes/statuses.ts` works.

Exports:
- `NOTE_TAGS` — `readonly` tuple of the enum values, mirrored from Prisma
- `NoteTag` — TS type derived from the tuple
- `NOTE_TAG_LABELS: Record<NoteTag, string>` — display strings (`{ TIMING: "Timing", SPACING: "Spacing", ... }`)
- `NOTE_TAG_DESCRIPTIONS: Record<NoteTag, string>` — short helper sentences for the composer's tag picker tooltip
- `isNoteTag(value: unknown): value is NoteTag` — runtime guard for API validation

Mirror the Prisma enum literally (don't import Prisma's enum here — keeps the module client-safe, same pattern `statuses.ts` follows).

### `lib/notes/repeating.ts` (new) — parallel to `stalled.ts`

This is pure derivation, no DB access. Takes already-fetched data and computes which assignments are part of a repeating cluster.

```typescript
import { isActiveStatus, type NoteStatus } from "./statuses";
import type { NoteTag } from "./tags";

export const REPEATING_THRESHOLD = 2;

type RepeatingInput = {
  // assignments across one project, with their note tag + status
  assignments: ReadonlyArray<{
    id: string;
    userId: string;
    projectId: string;
    tag: NoteTag | null;
    status: NoteStatus;
  }>;
};

export type RepeatingCluster = {
  userId: string;
  projectId: string;
  tag: NoteTag;
  assignmentIds: string[]; // all assignments in the cluster
  count: number;            // assignmentIds.length
};

/**
 * Groups active assignments by (userId, projectId, tag) and returns
 * groups whose size meets REPEATING_THRESHOLD.
 */
export function detectRepeatingClusters(
  input: RepeatingInput
): RepeatingCluster[] { /* ... */ }

/**
 * Convenience: build a Set<assignmentId> for O(1) membership check
 * when rendering rows.
 */
export function buildRepeatingAssignmentIdSet(
  clusters: RepeatingCluster[]
): Set<string> { /* ... */ }

/**
 * Convenience: build Map<userId, Map<NoteTag, RepeatingCluster>> for
 * the drill-list grouping, where each dancer-tag pair is one drill.
 */
export function indexClustersByUserAndTag(
  clusters: RepeatingCluster[]
): Map<string, Map<NoteTag, RepeatingCluster>> { /* ... */ }
```

Pure functions. `now` injection isn't needed since "repeating" is point-in-time over current statuses, not time-based.

### Type co-location

- `app/my-notes/types.ts`: add `tag: NoteTag | null` to `AssignedNoteRow.note`. Add `repeating: RepeatingMarker | null` (where `RepeatingMarker = { tag: NoteTag; count: number }`).
- `app/notes-by-me/types.ts`: add `tag: NoteTag | null` to `AuthoredNoteRow`. Add per-recipient repeating info: `assignments[i].repeating: RepeatingMarker | null`.
- `app/rehearsals/[rehearsalId]/workspace/types.ts`: add `tag: NoteTag | null` to `NoteItem`.
- New: `app/projects/[projectId]/drill-list/types.ts` — `DrillItem`, `DrillBucket`, `DrillBoard`.

---

## 3. API + server-action changes

### `lib/api/contracts.ts`

Extend the discriminated unions. Tags apply uniformly to TEXT and VOICE so both branches gain the same field:

```typescript
import type { NoteTag } from "@/lib/notes/tags"  // or inline literal union

export type CreateTextNoteRequest = {
  noteType?: "TEXT"
  bodyText: string
  startTimestampMs: number
  tag?: NoteTag | null   // NEW
  targets?: NoteTargetInput[]
  // deprecated assigneeUserIds...
}

export type CreateVoiceNoteRequest = {
  noteType: "VOICE"
  audioAssetId: string
  startTimestampMs: number
  endTimestampMs: number
  tag?: NoteTag | null   // NEW
  targets?: NoteTargetInput[]
}

export type UpdateTextNoteRequest = {
  noteType?: "TEXT"
  bodyText: string
  startTimestampMs: number
  tag?: NoteTag | null   // NEW
  targets: NoteTargetInput[]
}

export type UpdateVoiceNoteRequest = {
  noteType: "VOICE"
  startTimestampMs: number
  endTimestampMs: number
  tag?: NoteTag | null   // NEW
  targets: NoteTargetInput[]
}
```

Optional with `null` allowed (omitted = leave unchanged on PATCH; null = explicitly clear). PATCH semantics: if the field is `undefined` in the body, don't touch the column; if it's `null`, set the column to null; if it's a valid enum value, set it.

### `app/api/rehearsals/[rehearsalId]/notes/route.ts`

In the POST handler, parse and validate `tag`:
- After reading `body`, add a tag-validation block: if `body.tag === undefined || body.tag === null`, set `tagToWrite = null`. Otherwise call `isNoteTag(body.tag)` from `lib/notes/tags.ts`; on failure return `apiError(400, "INVALID_TAG", "tag must be one of: TIMING|SPACING|ENERGY|MUSICALITY|FORMATION|TECHNIQUE")`.
- Pass `tag: tagToWrite` into the `tx.note.create({ data: { ... } })` call.

### `app/api/notes/[noteId]/route.ts`

In the PATCH handler:
- Parse `body.tag`. If absent (`undefined`), leave the existing column untouched. If present, validate via `isNoteTag` (allowing explicit `null` to clear).
- Pass `tag: tagToWrite` into `tx.note.update({ data: { ... } })`. Use a conditional: `...(body.tag !== undefined && { tag: tagToWrite })` so we don't overwrite when the client didn't send it.

The DELETE handler doesn't change.

### `lib/notes/get-assigned-notes-for-user.ts` and `get-notes-by-author.ts`

No code change needed — both use `include` not `select` for `note`, so the new `tag` column comes through automatically once the Prisma client is regenerated.

But to drive repeating-detection efficiently, **add a new helper**:

`lib/notes/get-active-assignments-for-project.ts`
- Used by the drill list page server entry, the project-level summary card on `/projects/[projectId]`, and the `/my-notes` + `/notes-by-me` server entries (so we can compute `repeating` once per request).
- Returns flat rows: `{ assignmentId, userId, projectId, noteId, tag, status, userName, userEmail, ... }` for all active assignments visible to the current user across (a) all projects they're a recipient on, or (b) all projects they author notes in, or (c) a specific project.
- Query: `db.noteAssignment.findMany({ where: { /* scope */, status: { is: { OR: [{ status: 'OPEN' }, { status: 'IN_PROGRESS' }] } } OR status: null }, include: { user, status, note: { select: { tag, rehearsal: { select: { projectId } } } } } })`. Note: status absent = OPEN, so "active" must include `status: null`.
- The "scope" filter is the parameter. Three call sites; three scope shapes.

### Server actions

No new server actions for tags themselves — tag is set via the existing note-create / note-edit API routes. The status mutation server action (`app/my-notes/note-status-actions.ts`) doesn't need changes; it's tag-agnostic.

---

## 4. Composer + edit-sheet UX

### Tag selector component

New: `app/rehearsals/[rehearsalId]/workspace/tag-picker.tsx` — a small, reusable Radix `Popover` (not `Select`, because the existing audience picker is also a popover and the composer's vocabulary is popovers + pills, not native selects). Props:

```typescript
type TagPickerProps = {
  value: NoteTag | null;
  onChange: (next: NoteTag | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";  // sm for composer sub-bar, md for edit sheet
};
```

Renders a chevron-pill trigger ("Tag · Timing" or "+ Tag" when null) → popover with the 6 tag options as a vertical list (each row: tag label + tooltip-style description on hover; "Clear tag" footer link). Single-select; clicking a selected option closes the popover.

### Composer integration (`add-note-card.tsx`)

The sub-bar is already wrapped (`flex flex-wrap items-center gap-2`), so the tag pill slots in cleanly without breaking the existing flow. Placement: **between the audience popover and the timestamp pill**, with a `<span aria-hidden className="h-4 w-px bg-border" />` separator on each side. Existing layout reads:

```
[Tabs: Text | Voice] · | · To [audience] · [+ Tag] · | · Note appears at MM:SS
```

The `ml-auto` on the timestamp button still pushes the timestamp to the right end. The tag pill is `h-7` like the audience and timestamp pills, so the row height is unchanged.

`AddNoteCard` needs new state `const [tag, setTag] = useState<NoteTag | null>(null);` plus a prop drilling change — the parent `RehearsalWorkspace` owns submission, so `AddNoteCard` already accepts an `onSubmit` callback. Either:
- (a) Lift `tag` to `RehearsalWorkspace` like the other note-state, mirroring `noteText`. **Recommended** — keeps the pattern consistent.
- (b) Keep `tag` local and pass it up via `onSubmit(tag)`. Inconsistent with the rest of the composer.

The voice-note flow (`voice-note-recorder.tsx`) submits its own POST. Pass the current tag selection down via `buildTargets`-style accessor — rename to `buildSubmitExtras` returning `{ targets, tag }`, or add a sibling `getTag: () => NoteTag | null` prop.

### Edit-sheet integration (`edit-note-sheet.tsx`)

Add a new `Field` block between "Note" and "Audience":

```tsx
<Field>
  <FieldLabel>Tag</FieldLabel>
  <FieldContent>
    <TagPicker value={tag} onChange={setTag} disabled={isPending} size="md" />
    <FieldDescription>
      Helps surface repeated corrections — e.g. multiple TIMING notes for the same dancer.
    </FieldDescription>
  </FieldContent>
</Field>
```

`EditableNote.tag: NoteTag | null` and `EditNoteFormValues.tag: NoteTag | null`. Initial state from `note.tag`. On submit, `tag` flows into `requestBody.tag` in the PATCH callers (`notes-by-me-list.tsx` ~L260 and the workspace edit handler in `rehearsal-workspace.tsx`).

---

## 5. Note row integration

### Tag chip primitive

New: `components/tag-chip.tsx`. Single neutral-styled chip:

```tsx
<span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
  <Tag aria-hidden className="size-2.5" />
  {NOTE_TAG_LABELS[tag]}
</span>
```

Props: `tag: NoteTag`, `size?: "xs" | "sm"`. Uses `--muted` / `--muted-foreground` so it dark-mode-adapts.

### Repeating chip primitive

New: `components/repeating-chip.tsx`. A separate visual primitive because it has a count and a different semantic weight:

```tsx
<span style={{ backgroundColor: "var(--repeating-bg)", color: "var(--repeating-fg)", borderColor: "var(--repeating-border)" }} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
  <Repeat aria-hidden className="size-3" />
  Repeating · {NOTE_TAG_LABELS[tag]} × {count}
</span>
```

The CSS vars are new — see Section 9.

### Workspace `NoteRow` (`notes-list-card.tsx` ~L151)

Place tag chip in the body's top meta row (right after author name, before the actions menu). Place repeating chip in the **assignments row** because repeating is a per-recipient signal, not a per-note one — a single note can be repeating for one dancer and not another. Specifically: extend `StatusChip` to optionally render a `Repeat` icon prefix when that assignment is part of a repeating cluster, OR add a small `RepeatingChip` next to the StatusChip. **I recommend the latter** — keeps `StatusChip` single-purpose. Visually: `<StatusChip /> <RepeatingChip />` cluster grouped per recipient.

At the note level (regardless of recipient), if any of this note's assignments are part of a repeating cluster, show the tag chip with a small "repeating" decoration. But the per-recipient signal is the load-bearing one — the dancer cares whether *they* keep getting this note, not whether anyone does.

### `/my-notes` `AssignedNoteCard` (`assigned-note-card.tsx`)

- Tag chip: in the **top meta row**, between `NoteTimestampPill` and the relative-age (so the row reads "rehearsal › title · 02:14 · Timing · 2d ago"). The tag is a property of the note, not the recipient, so this is the natural slot.
- Repeating chip: also top meta row, immediately after the tag chip when present. This is a recipient-side signal — "you've gotten 3 timing notes" is exactly the kind of thing that should be loud on the inbox card.

### `/notes-by-me` `AuthoredNoteCard` (`authored-note-card.tsx`)

- Tag chip: in the **top meta row**, after `NoteTimestampPill`, before the voice/text pill.
- Repeating: this card aggregates *across recipients*, so the per-recipient signal lives on the `RecipientPipRow` (`recipient-pip-row.tsx`). For each pip, if that assignment is repeating, decorate it with a small `Repeat` icon next to the status dot (with title="Repeating: 3 unresolved Timing notes"). Don't show the full chip in the pip row — too much for a 24px chip. The tag chip on the card already tells the author "this note has a tag"; the repeat decoration on the pip tells them "this dancer has a pattern".

### Stalled + Repeating coexistence

A note can be both stalled and repeating. They're orthogonal signals: stalled is "old and not moving" (time-based on the note); repeating is "you're seeing this same correction for this dancer again" (cross-note pattern). Visual treatment:
- Both chips render in the same meta row.
- Order: stalled first (existing position), repeating second.
- Card border: stalled already adds `border-[color:var(--status-progress-border)]`. Repeating does NOT change the border — that would create competing emphases. The repeating chip carries the signal.
- On the recipient pip row, both decorations can stack: stalled tints the pip in-progress, repeating adds the icon. They visually combine without conflict.

---

## 6. Filter integration

### `/my-notes` `QueueSummary` (`queue-summary.tsx`)

Add a new `Tag` filter section, slotted between `Project` and `Type` inside the disclosure block:

```tsx
{/* Tag */}
{tagOptions.length > 0 ? (
  <section className="flex flex-col gap-2">
    <RailHeader>Tag</RailHeader>
    <div className="flex flex-wrap gap-1">
      {tagOptions.map((tag) => /* same pattern as Project, but a Tag icon and a count */)}
    </div>
  </section>
) : null}
```

`MyNotesFilter` extends with `tag: NoteTag | null`. `EMPTY_FILTER` extends with `tag: null`. `rowMatchesFilter` adds the `if (filter.tag && row.note.tag !== filter.tag) return false;` check. `tagOptions` derived in the same `useMemo` that derives `authorOptions` — count notes per tag in the unfiltered set.

Mobile disclosure's `activeFilterCount` gains `(filter.tag ? 1 : 0)`.

### `/notes-by-me` `FilterSortBar` (`filter-sort-bar.tsx`)

The filter pills are status-shape (Outstanding / Stalled / etc.); they're not the right surface for a tag filter. **Add a separate tag-filter row** to the bar — a horizontally scrolling pill row below the status pills, only visible when `notes.length > 0` and at least one tagged note exists. Each pill: tag label + count + active-state styling identical to the existing pills.

`AuthoredNoteFilter` stays as-is; tag filter is a sibling state in `NotesByMeList` (`const [tagFilter, setTagFilter] = useState<NoteTag | null>(null)`). The `rowMatchesFilter` becomes a two-step filter: status-bucket match AND tag match.

Add a "Repeating only" toggle pill on the same row — for v1 this is a derived filter (`notes.filter(row => row.assignments.some(a => a.repeating !== null))`). It's in the same filter category as the status pills logically, but visually it sits with the tag filter row because it's tag-driven.

### Workspace pill row (`notes-list-card.tsx` ~L52)

`PILL_FILTER_ORDER` is already 8 items long; adding 6 tag pills there would crowd the row. Instead, add a **sibling** "Tag" `<Select>` next to the existing assignee `<Select>` on the right side of the filter row. Same pattern as `assigneeFilter`. New state `tagFilter: NoteTag | "ALL"`. `matchesPillFilter` is unchanged; add `matchesTag` and AND it with the pill match in `filteredNotes`.

---

## 7. Aggregation surface (server-side computation)

The "repeating" signal is computed server-side once per request, mirroring how stalled is computed. Three call sites:

### `/my-notes/page.tsx`

After fetching `assignments`, fetch active assignments scoped to the current user's projects (one query):

```typescript
const projectIdsInScope = new Set(assignments.map(a => a.note.rehearsal.project.id));
const activeAssignments = await getActiveAssignmentsAcrossProjects(dbUser.id, projectIdsInScope);
const clusters = detectRepeatingClusters({ assignments: /* shaped */ });
const repeatingByAssignmentId = buildRepeatingMap(clusters); // Map<assignmentId, { tag, count }>
```

Then map each `AssignedNoteRow.repeating = repeatingByAssignmentId.get(assignment.id) ?? null` during the existing `rows` build. Since the recipient (current user) is the dancer in question, all of *this user's* clusters are surfaceable on their `/my-notes`.

### `/notes-by-me/page.tsx`

Author sees clusters across all recipients. After fetching `notes`, fetch all active assignments across the same set of projects (the projects whose notes the author has authored):

```typescript
const projectIds = uniq(notes.map(n => n.rehearsal.project.id));
const activeAssignments = await getActiveAssignmentsForProjects(projectIds);
const clusters = detectRepeatingClusters({ assignments: /* shaped */ });
```

Map clusters to assignment IDs, then in the row build, set `assignment.repeating = repeatingMap.get(assignment.id) ?? null` per pip.

Add a new summary metric to `AuthorSummaryStrip` (`author-summary-strip.tsx`): a 4th tile or a chip "X dancers with repeating corrections" (the count of distinct `userId`s with at least one cluster). Click jumps to a "Repeating only" filter state.

### `/projects/[projectId]/page.tsx`

Two new sections, both placed between `ProjectMetaBand` and `RehearsalsSection`:

**1. `<RepeatingClustersCard />`** (only visible when `clusters.length > 0`).
A compact summary card listing each cluster as a row: `<AvatarInitials />` + dancer name + `<TagChip />` + count text ("3 unresolved") + an "Expand below" affordance that scrolls to and opens that dancer's row in the drill section below.

**2. `<ProjectDrillSection />`** (see Section 8b).
The full per-dancer drill board for the project, collapsible per dancer. Card hides entirely when the project has no active assignments at all.

Both cards share the same underlying `activeAssignments` + `clusters` data fetched once in the page server entry. The repeating clusters card is the *summary* (a quick triage signal); the drill section is the *detail* (the actual checklist instructors will pull up during rehearsal).

---

## 8. Drill surfaces (replaces "drill list page")

Two surfaces, no new route. The data underlying both is the same per-project active-assignment query already specified in Section 3 (`get-active-assignments-for-project.ts`).

### 8a. Print mode on `/my-notes` — dancer surface

A toggle that flips `/my-notes` from "inbox" mode to "drill" mode. Same data, different layout, optimized for printing.

**Toggle UI**: a `Tabs`-style 2-option control in the slim title bar at the top of `/my-notes`: `Inbox` (default) / `Drill view`. Persisted in URL search param `?view=drill` so it's shareable / bookmarkable but not stored server-side.

**Drill view layout** (when `view === "drill"`):
- Hides: hero card, status segmented controls, "Open in rehearsal" links, voice-note play controls, queue-summary status breakdown.
- Replaces inbox-card-list with a tag-grouped checklist:
  - Top section: any of the user's repeating clusters surfaced first as "Recurring drills" with the `<RepeatingChip />` header.
  - Below that: each tag (in fixed display order — TIMING, SPACING, ENERGY, MUSICALITY, FORMATION, TECHNIQUE, then "Other" for untagged) renders as a `<DrillTagSection>` with a `<TagChip />` heading and clamped 2-line note rows underneath.
  - Each row: rehearsal title · timestamp pill · clamped body (or "Voice note · 0:14") · status dot. No interactive controls. A small empty checkbox visual on the left (for paper marking).
- Keeps: project filter from `QueueSummary` (so a dancer can drill one project's notes).
- Adds: a "Print / Save as PDF" button in the title bar that calls `window.print()`.

**State changes in `MyNotesList`**:
- Add `viewMode: "inbox" | "drill"` derived from `useSearchParams().get("view")`.
- Branch the body render: `viewMode === "drill"` renders `<DrillView rows={filteredRows} repeatingByAssignmentId={...} />`; otherwise the existing inbox layout.
- The status-bucket / hero / sort logic only runs when `viewMode === "inbox"`.

**Components (new, all under `app/my-notes/`)**:
- `drill-view.tsx` — the orchestrator for drill mode. Receives the filtered rows + repeating map; groups, renders.
- `drill-tag-section.tsx` — one tag's group: `<TagChip>` + `<RepeatingChip>` (if applicable) heading + ordered list of `<DrillRow />`.
- `drill-row.tsx` — single read-only row.
- `view-toggle.tsx` — tiny client component for the inbox/drill `Tabs`-style control; pushes `?view=` via `router.replace`.

### 8b. Drill section on `/projects/[projectId]` — instructor surface

Below the `RepeatingClustersCard` (Section 7), add a new collapsible `<ProjectDrillSection>` card:

- **Header**: "Drill board" title + helper text ("All open + in-progress notes, grouped by dancer and tag.") + "Expand all / Collapse all" button.
- **Body**: per-dancer expandable row — `<AvatarInitials>` + name + summary ("4 open notes across 2 tags · 1 repeating") + chevron. Default expansion: viewer's own row (if they're a recipient in this project), otherwise the dancer with the most repeating clusters.
- **Expanded row**: tag-grouped checklist for that dancer (same `<DrillTagSection>` component as 8a, reused).
- **Visibility**: card hides entirely when `activeAssignments.length === 0`.
- **No print button here** — print mode lives on `/my-notes` for v1. Whole-company print sheets are a deferred feature.

**Component (new)**: `app/projects/[projectId]/project-drill-section.tsx`. Imports `DrillTagSection` from `app/my-notes/drill-tag-section.tsx` (cross-feature import is fine; the alternative is duplicating it). If we get a third consumer, lift to `components/drill/`.

### 8c. Print stylesheet (`app/globals.css`)

Add a `@media print` block at the bottom of `globals.css`:

```css
@media print {
  header, nav, [data-print-hidden] { display: none !important; }
  [data-print-only] { display: block !important; }

  :root {
    /* override token surface for ink economy */
    --background: white;
    --foreground: oklch(0.15 0 0);
    --muted: oklch(0.96 0 0);
    --muted-foreground: oklch(0.3 0 0);
  }

  .drill-tag-section { break-inside: avoid; }
  .drill-row { break-inside: avoid; }

  /* tag chips: switch from filled bg to border for B&W printability */
  .tag-chip {
    background: transparent !important;
    border: 1px solid currentColor !important;
  }
}
```

Drill-mode components opt into this via `data-print-hidden` (filter rows, view toggle, header chrome) and `data-print-only` (the print header showing project + date). The print header is a small `<PrintHeader>` component that renders `display: none` normally and is unhidden by the print stylesheet.

### What's NOT here (deferred)

- Dedicated `/projects/[id]/drill-list` route (sub-route page).
- Whole-company print sheets (instructors printing a single document with all dancers).
- Shareable drill URLs with `?dancer=USER_ID` filters.
- PDF export endpoint.

These come back if usage data shows the lighter-weight surfaces aren't enough.

---

## 9. Design tokens

New CSS variables for the repeating signal, defined in both `:root` and `.dark` in `app/globals.css`. I recommend tying repeating to a new hue rather than reusing an existing one — repeating is conceptually distinct from in-progress/open/etc.

```css
/* :root */
--repeating-bg: oklch(0.94 0.04 280);     /* soft violet/plum tint */
--repeating-fg: oklch(0.42 0.12 290);
--repeating-border: oklch(0.84 0.06 285);

/* .dark */
--repeating-bg: oklch(0.3 0.04 285);
--repeating-fg: oklch(0.8 0.09 285);
--repeating-border: oklch(0.4 0.07 285);
```

Reasoning for hue: `--status-*` covers blue/teal/green range; `--note-voice-*` is coral (orange); avatars cycle through teal/coral/olive/plum. Repeating wants to be a sibling of voice-coral in role (a *flag* rather than a status state), and plum/violet at hue 280-290 stays out of the way of all existing tones.

**No new tokens for tags themselves** — they use `--muted` / `--muted-foreground` per the single-neutral-chip recommendation.

---

## 10. Testing / verification checklist

Manual verification across the three views, in order:

**Migration & schema**
- [ ] `npx prisma migrate dev` applies cleanly
- [ ] `npx prisma generate` succeeds; `Note.tag` is `NoteTag | null`
- [ ] Existing notes load with `tag = null`

**Composer**
- [ ] Tag pill appears in the sub-bar between audience and timestamp; renders "+ Tag" when null
- [ ] Selecting a tag updates the pill label; clearing reverts to "+ Tag"
- [ ] TEXT submission persists tag; row re-fetched via `revalidate` shows tag
- [ ] VOICE recording → save persists tag in the note created at step 4 of the upload flow
- [ ] Tag selection survives between consecutive note submissions (or resets — pick a behavior; recommend persists, like audience does)

**Edit sheet**
- [ ] Tag field renders with the current tag pre-selected; shows "+ Tag" when null
- [ ] Saving with no change to tag preserves the existing value (no PATCH-clears-on-undefined regression)
- [ ] Explicitly clearing tag persists `null`

**Workspace `NoteRow`**
- [ ] Tag chip renders next to author name when tag is set
- [ ] Repeating decoration appears on individual `StatusChip`s when that assignment is in a cluster
- [ ] Stalled + repeating coexist visually without overlap
- [ ] Tag `<Select>` filter works alongside existing assignee filter and pill filter (AND semantics)

**`/my-notes`**
- [ ] Tag chip renders in top meta row of `AssignedNoteCard`
- [ ] Repeating chip renders next to it when applicable
- [ ] New "Tag" filter section appears in `QueueSummary` rail; mobile disclosure counts `tagFilter` toward `activeFilterCount`
- [ ] Tag filter ANDs with existing author/project/type filters
- [ ] Hero pick rule unchanged (oldest unresolved); tag filter reduces the candidate pool correctly

**`/notes-by-me`**
- [ ] Tag chip in card top row
- [ ] Repeating decoration on `RecipientPipRow` per-pip when a recipient's assignment is in a cluster
- [ ] New tag-filter row below status pills; clears with the existing "clear filters" affordance (add one if not present)
- [ ] `AuthorSummaryStrip` shows the new "X dancers with repeating corrections" count; click filters to repeating-only

**Project page**
- [ ] `RepeatingClustersCard` renders between meta band and rehearsals section when clusters exist
- [ ] Card hides when no clusters
- [ ] `ProjectDrillSection` renders below the clusters card when at least one active assignment exists in the project
- [ ] Drill section hides entirely when no active assignments
- [ ] Per-dancer rows expand independently; default expansion is viewer's own row when they're a recipient, else the dancer with the most clusters
- [ ] Expanded row shows tag-grouped checklist; untagged notes fall into "Other"; repeating clusters get the repeating chip
- [ ] "Expand below" affordance on the cluster card scrolls to + opens the matching dancer row in the drill section

**`/my-notes` drill mode**
- [ ] Inbox / Drill view toggle in the title bar; URL syncs `?view=drill`
- [ ] Drill mode hides hero, status segmented controls, voice play controls, "Open in rehearsal" links
- [ ] Repeating clusters surface at top under "Recurring drills" with `RepeatingChip`
- [ ] Tag-grouped sections render in fixed order: TIMING, SPACING, ENERGY, MUSICALITY, FORMATION, TECHNIQUE, Other
- [ ] Project filter from `QueueSummary` still works in drill mode
- [ ] "Print" button calls `window.print()`; printed page has chrome hidden, print header visible, no page-break artifacts mid-section

**Authorization**
- [ ] DANCER role cannot set tag (they can't author or edit notes anyway — verify the existing role gate on POST/PATCH still blocks them with the new field present in the body)
- [ ] Project drill section enforces project membership via `getProjectForUser` (already gated by the page itself)

**Regression**
- [ ] Existing notes without a tag render normally on all three views (no chip, no errors, no `null` text leakage)
- [ ] Repeated saves on a tagged note don't change the tag column unless the field is sent in the body

---

## 11. What's deliberately out of scope for v1

These were considered and rejected — flagging so they can be confirmed or pulled back in:

1. **Multi-tag per note.** Single tag, one column. Multi-tag deferred until users ask.
2. **Per-tag color coding.** Single neutral chip; the design system is already at color capacity. Revisit if scanability becomes a complaint.
3. **Tag analytics dashboard.** No "you've authored 47 TIMING notes this month" page. Repeating-cluster surfaces give the only tag-derived analytic that drives action.
4. **Smart text-similarity detection** ("these two notes both say 'rush'"). v1 ships pure tag equality. Real similarity needs an embeddings or NLP layer that's a separate project.
5. **Cross-project repeating.** Project-scoped only. Cross-project would surface stale signals from past shows.
6. **Tag-based notifications** ("you've been notified 3 times for TIMING this week"). Email/push notifications aren't in the app at all yet.
7. **Tag editing for dancers.** Tags are author-controlled. Dancers can update status only. Same role gate as the rest of note-editing.
8. **PDF export endpoint.** `window.print()` → "Save as PDF" is the v1 path. A server-side PDF renderer is deferred.
9. **Drill-list status mutation.** Read-only with deep links to `/my-notes`. Avoids duplicate-mutation-surface bugs.
10. **Bulk tag operations** (retroactively tag a batch of notes). One note at a time via the edit sheet for v1.
11. **Tag suggestions in the composer** ("notes with the word 'spacing' in the body suggest the SPACING tag"). Manual selection only; suggestions are an ML-adjacent feature.
12. **Parent / guardian visibility.** Out of scope for the whole app per the privacy page; not specific to this feature.
13. **Drill-list per-rehearsal scope.** v1 is per-project. A rehearsal-scoped drill list ("tonight only") could ship as a follow-up if directors ask.
14. **Required tags via team setting.** Tags are optional everywhere; no team-level "tags required" toggle in v1.
15. **Dedicated drill list page** (`/projects/[id]/drill-list`). Drill capability ships as print mode on `/my-notes` + project-page drill section. Revisit when users ask for shareable URLs (`?dancer=USER_ID`) or whole-company print sheets that include all dancers in one document.
16. **Curated "tonight's drill list"**. A separate stored entity (`DrillSheet` + `DrillSheetItem`) where the instructor hand-picks which open notes to focus on. The current derived approach is always-correct-by-definition; curation comes back as a v2 only if instructors say "the full list is too long for a single rehearsal."

---

## Critical Files for Implementation

- `prisma/schema.prisma`
- `lib/api/contracts.ts`
- `app/rehearsals/[rehearsalId]/workspace/add-note-card.tsx`
- `app/projects/[projectId]/page.tsx`
- `app/globals.css`

Supporting (will be touched but not net-new logic): `lib/notes/tags.ts` (new), `lib/notes/repeating.ts` (new), `app/api/rehearsals/[rehearsalId]/notes/route.ts`, `app/api/notes/[noteId]/route.ts`, `app/my-notes/queue-summary.tsx`, `app/notes-by-me/notes-by-me-list.tsx`, and the new `app/projects/[projectId]/drill-list/*` files.

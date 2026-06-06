import type {
  DiscussionStartedActivity,
  NoteAddedActivity,
  StatusChangeActivity,
  ThreadReplyActivity,
} from "@/lib/activity/types";
import { NOTE_TAG_LABELS } from "@/lib/notes/tags";

import {
  ActivityAvatar,
  ActivityBody,
  ActivityBodyMuted,
  ActivityHeader,
  ActivityMeta,
  ActivityQuote,
  ActivityRow,
  StatusPill,
  VoicePeek,
} from "./activity-row";

/**
 * One component per `ActivityItem.kind`. Each handles its own href,
 * actor-prefix sentence, and body shape — the visual frame stays
 * consistent via the shared `ActivityRow` + slot subcomponents.
 *
 * Hrefs are simple v1 routes — they point at the surface where the note
 * or discussion lives. No anchors yet (no stable element IDs on those
 * pages); refinement is deferred.
 */

/* ------------------------------ note-added ------------------------------ */

export function NoteAddedRow({
  item,
  age,
}: Readonly<{ item: NoteAddedActivity; age: string }>) {
  const href = `/rehearsals/${item.scope.rehearsalId ?? ""}`;
  const audience = item.isForViewer
    ? "for you"
    : item.audienceLabel
      ? `for ${item.audienceLabel}`
      : null;
  const verb =
    item.noteType === "VOICE" ? "left a voice note" : "added a note";

  return (
    <ActivityRow
      href={href}
      ariaLabel={`${item.actor.name ?? "Someone"} ${verb}${audience ? ` ${audience}` : ""}`}
    >
      <ActivityAvatar actor={item.actor} />
      <div className="min-w-0 flex-1">
        <ActivityHeader
          actor={item.actor}
          prefix={
            <>
              {verb}
              {audience ? <> {audience}</> : null}
            </>
          }
          age={age}
        />
        <ActivityMeta
          scope={item.scope}
          timestampMs={item.startTimestampMs}
          tag={item.tag}
        />
        {item.noteType === "VOICE" ? (
          <VoicePeek
            durationMs={item.voice?.durationMs ?? null}
            transcript={
              item.voice?.transcriptStatus === "READY"
                ? item.voice.transcript
                : null
            }
          />
        ) : item.bodyExcerpt ? (
          <ActivityBody>{item.bodyExcerpt}</ActivityBody>
        ) : null}
      </div>
    </ActivityRow>
  );
}

/* ----------------------------- thread-reply ----------------------------- */

export function ThreadReplyRow({
  item,
  age,
  highlight,
}: Readonly<{
  item: ThreadReplyActivity;
  age: string;
  /** Dot before actor name indicating viewer hasn't read this reply yet. */
  highlight?: boolean;
}>) {
  const href =
    item.parent.type === "note"
      ? `/rehearsals/${item.scope.rehearsalId ?? ""}`
      : item.scope.rehearsalId
        ? `/rehearsals/${item.scope.rehearsalId}`
        : `/projects/${item.scope.projectId}`;
  const prefix =
    item.parent.type === "note"
      ? "replied to your thread"
      : "replied to a discussion";

  return (
    <ActivityRow
      href={href}
      ariaLabel={`${item.actor.name ?? "Someone"} ${prefix}`}
    >
      <ActivityAvatar actor={item.actor} />
      <div className="min-w-0 flex-1">
        <ActivityHeader
          actor={item.actor}
          prefix={prefix}
          age={age}
          highlight={highlight}
        />
        <ActivityMeta
          scope={item.scope}
          timestampMs={
            item.parent.type === "note"
              ? item.parent.parentStartTimestampMs
              : (item.parent.parentStartTimestampMs ?? null)
          }
        />
        <ActivityQuote>{item.bodyExcerpt}</ActivityQuote>
      </div>
    </ActivityRow>
  );
}

/* ----------------------------- status-change ---------------------------- */

export function StatusChangeRow({
  item,
  age,
}: Readonly<{ item: StatusChangeActivity; age: string }>) {
  const href = `/rehearsals/${item.scope.rehearsalId ?? ""}`;
  const tagLabel = item.noteTag ? NOTE_TAG_LABELS[item.noteTag] : "your";

  return (
    <ActivityRow
      href={href}
      ariaLabel={`${item.actor.name ?? "Someone"} marked ${tagLabel} note`}
    >
      <ActivityAvatar actor={item.actor} />
      <div className="min-w-0 flex-1">
        <ActivityHeader
          actor={item.actor}
          prefix={
            <>
              marked your {item.noteTag ? `${tagLabel.toLowerCase()} ` : ""}note
            </>
          }
          age={age}
        />
        <ActivityMeta
          scope={item.scope}
          timestampMs={item.noteStartTimestampMs}
          tag={item.noteTag}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} />
          {item.noteBodyExcerpt ? (
            <span className="line-clamp-1 min-w-0 flex-1 text-[12.5px] text-muted-foreground">
              {item.noteBodyExcerpt}
            </span>
          ) : null}
        </div>
      </div>
    </ActivityRow>
  );
}

/* --------------------------- discussion-started ------------------------- */

export function DiscussionStartedRow({
  item,
  age,
}: Readonly<{ item: DiscussionStartedActivity; age: string }>) {
  const href = item.scope.rehearsalId
    ? `/rehearsals/${item.scope.rehearsalId}`
    : `/projects/${item.scope.projectId}`;

  return (
    <ActivityRow
      href={href}
      ariaLabel={`${item.actor.name ?? "Someone"} started a discussion`}
    >
      <ActivityAvatar actor={item.actor} />
      <div className="min-w-0 flex-1">
        <ActivityHeader
          actor={item.actor}
          prefix="started a discussion"
          age={age}
        />
        <ActivityMeta scope={item.scope} timestampMs={item.startTimestampMs} />
        {item.noteType === "VOICE" ? (
          <VoicePeek durationMs={null} transcript={null} />
        ) : item.bodyExcerpt ? (
          <ActivityBodyMuted>&ldquo;{item.bodyExcerpt}&rdquo;</ActivityBodyMuted>
        ) : null}
      </div>
    </ActivityRow>
  );
}

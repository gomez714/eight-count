import { ArrowUpRight, FileText, Mic } from "lucide-react";
import Link from "next/link";

import { formatNoteTimestamp } from "@/lib/notes/format";
import type { RepeatingClusterDetail } from "@/lib/notes/repeating";

const MAX_VISIBLE_TIMESTAMPS = 8;

type RepeatingClusterDetailsProps = {
  detail: RepeatingClusterDetail;
};

/**
 * The inline panel that drops below an `ExpandableRepeatingChip` when the
 * user opens it. Turns a decorative "Repeating × 3" flag into an
 * actionable surface:
 *   - one quoted body from the most-recent note (text or voice transcript)
 *   - a row of clickable timestamp pills covering every instance in the
 *     cluster (capped at 8 + "+N more" for very large clusters)
 *   - a "View latest note" link to the most-recent note's rehearsal
 *
 * Pure presentation. Caller passes a precomputed `RepeatingClusterDetail`
 * with items sorted newest-first.
 */
export function RepeatingClusterDetails({
  detail,
}: Readonly<RepeatingClusterDetailsProps>) {
  // Items are pre-sorted newest-first; the head is what we quote.
  const latest = detail.items[0];
  if (!latest) return null;

  const visibleTimestamps = detail.items.slice(0, MAX_VISIBLE_TIMESTAMPS);
  const hiddenCount = Math.max(
    0,
    detail.items.length - MAX_VISIBLE_TIMESTAMPS,
  );

  const latestBody = readableBody(latest);
  const isLatestVoice = latest.noteType === "VOICE";

  return (
    <div
      // Excluded from print: the panel's content (latest body + timestamps)
      // duplicates info already in the drill row list, and the interactive
      // affordances (link, pills) are dead on paper. The existing print
      // stylesheet in `app/globals.css` hides `[data-print-hidden]` under
      // `body[data-print-target="drill"]`.
      data-print-hidden
      className="mt-2 flex flex-col gap-3 rounded-md border p-3 text-xs"
      style={{
        backgroundColor: "var(--repeating-bg)",
        borderColor: "var(--repeating-border)",
        color: "var(--foreground)",
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider uppercase"
          style={{ color: "var(--repeating-fg)" }}
        >
          {isLatestVoice ? (
            <Mic aria-hidden className="size-3" />
          ) : (
            <FileText aria-hidden className="size-3" />
          )}
          Latest instance
        </div>
        {latestBody ? (
          <blockquote
            className="m-0 border-l-2 pl-2.5 text-[12.5px] leading-snug italic text-foreground"
            style={{
              borderColor:
                "color-mix(in oklch, var(--repeating-fg) 35%, transparent)",
            }}
          >
            &ldquo;{latestBody}&rdquo;
          </blockquote>
        ) : (
          <span className="text-[12.5px] italic text-muted-foreground">
            {placeholderForMissingBody(latest)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          className="text-[10.5px] font-bold tracking-wider uppercase"
          style={{ color: "var(--repeating-fg)" }}
        >
          All {detail.count} instances
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visibleTimestamps.map((item) => (
            <Link
              key={item.assignmentId}
              href={`/rehearsals/${item.rehearsalId}`}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 font-mono text-[11px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              title={`${item.rehearsalTitle} · ${formatNoteTimestamp(item.startTimestampMs)}`}
            >
              {formatNoteTimestamp(item.startTimestampMs)}
            </Link>
          ))}
          {hiddenCount > 0 ? (
            <span
              className="inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground"
              title={`${hiddenCount} more — open the latest note to see them all`}
            >
              +{hiddenCount} more
            </span>
          ) : null}
        </div>
      </div>

      <Link
        href={`/rehearsals/${latest.rehearsalId}`}
        className="inline-flex w-fit items-center gap-1 self-start rounded-sm text-[12px] font-semibold underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring"
        style={{ color: "var(--repeating-fg)" }}
      >
        View latest note in {latest.rehearsalTitle}
        <ArrowUpRight aria-hidden className="size-3" />
      </Link>
    </div>
  );
}

/**
 * Picks the readable body for the latest item — preferring the Deepgram
 * transcript for voice notes when it's ready. Returns null when there's
 * no useful text (placeholder rendering handled by the caller).
 */
function readableBody(item: RepeatingClusterDetail["items"][number]): string | null {
  if (item.noteType === "VOICE") {
    const transcript = item.voiceTranscript?.trim();
    return transcript && transcript.length > 0 ? transcript : null;
  }
  const body = item.bodyText?.trim();
  return body && body.length > 0 ? body : null;
}

/**
 * Fallback text when `readableBody` returns null. Voice notes whose
 * transcript hasn't landed yet (or empty/failed transcription) fall
 * back to the same "Voice note · 0:32" placeholder used in drill rows
 * and standalone players; text notes with empty bodies (rare) get a
 * plain "No body text".
 */
function placeholderForMissingBody(
  item: RepeatingClusterDetail["items"][number],
): string {
  if (item.noteType !== "VOICE") return "No body text";
  if (item.audioDurationMs == null) return "Voice note · —";
  return `Voice note · ${formatNoteTimestamp(item.audioDurationMs)}`;
}

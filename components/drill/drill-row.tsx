import { FileText, Mic } from "lucide-react";
import Link from "next/link";

import { StatusDot } from "@/app/rehearsals/[rehearsalId]/workspace/status-chip";
import { formatNoteTimestamp } from "@/lib/notes/format";
import type { NoteStatus } from "@/lib/notes/statuses";

export type DrillRowItem = {
  rehearsalId: string;
  rehearsalTitle: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  /**
   * Voice-note transcript when transcription has succeeded. When present
   * and non-empty, the row uses this as its readable body — the highest-
   * value reason to ship transcripts at all (drill mode becomes useful
   * for offline study without the audio player).
   */
  voiceTranscript: string | null;
  audioDurationMs: number | null;
  startTimestampMs: number;
  status: NoteStatus;
};

type DrillRowProps = {
  item: DrillRowItem;
  /**
   * When set, a small muted project-name chip is rendered before the
   * rehearsal link. Used on `/my-notes` drill view when the user has notes
   * across 2+ projects.
   */
  projectName?: string;
};

function renderDrillBody(item: DrillRowItem) {
  const isVoice = item.noteType === "VOICE";
  const hasVoiceTranscript =
    isVoice &&
    typeof item.voiceTranscript === "string" &&
    item.voiceTranscript.trim().length > 0;

  if (hasVoiceTranscript) {
    return (
      <span className="truncate" title={item.voiceTranscript ?? undefined}>
        <Mic
          aria-hidden
          className="mr-1 inline size-3 text-muted-foreground"
        />
        {item.voiceTranscript}
      </span>
    );
  }

  if (isVoice) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Mic aria-hidden className="size-3" />
        Voice note
        {item.audioDurationMs != null && (
          <> · {formatNoteTimestamp(item.audioDurationMs)}</>
        )}
      </span>
    );
  }

  return (
    <span className="truncate" title={item.bodyText ?? undefined}>
      <FileText
        aria-hidden
        className="mr-1 inline size-3 text-muted-foreground"
      />
      {item.bodyText}
    </span>
  );
}

export function DrillRow({ item, projectName }: Readonly<DrillRowProps>) {
  return (
    <li className="drill-row flex items-center gap-2 rounded-md border bg-background px-3 py-2">
      {projectName ? (
        <span
          className="inline-flex max-w-[140px] items-center truncate rounded-full border border-border bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
          title={projectName}
        >
          {projectName}
        </span>
      ) : null}
      <Link
        href={`/rehearsals/${item.rehearsalId}`}
        data-print-hidden
        className="text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        {item.rehearsalTitle}
      </Link>
      <span data-print-only className="hidden text-[11px] text-muted-foreground">
        {item.rehearsalTitle}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {formatNoteTimestamp(item.startTimestampMs)}
      </span>
      <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13px] text-foreground">
        {renderDrillBody(item)}
      </span>
      <StatusDot status={item.status} />
    </li>
  );
}

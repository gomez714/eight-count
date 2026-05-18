import { Mic, Play } from "lucide-react";
import type { CSSProperties } from "react";

import { formatNoteTimestamp } from "@/lib/notes/format";

import { LandingAvatar, type AvatarTone } from "./avatar-initials";
import {
  AssigneePip,
  AudienceChip,
  type AudienceChipKind,
  type LandingStatus,
  TimestampPill,
} from "./chips";

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type Assignment = {
  initials: string;
  tone: AvatarTone;
  status: LandingStatus;
};

const WAVEFORM_BARS = 34;
const FILLED_BARS = Math.floor(WAVEFORM_BARS * 0.42);

const WAVEFORM = Array.from({ length: WAVEFORM_BARS }, (_, i) => ({
  id: `bar-${i}`,
  filled: i < FILLED_BARS,
  height: 4 + Math.abs(Math.sin(i * 0.6) * 14) + (i % 3) * 2,
}));

export function LandingVoiceNoteCard({
  ms = 122300,
  durationMs = 11500,
  author = "T. Okafor",
  authorTone = "coral",
  audience = [{ kind: "USER", label: "Iris Tan" }],
  transcript = "Iris — the second pirouette landed off-axis. Spot the back wall, not the camera. Try it twice and then we'll move on.",
  assignments = [{ initials: "IT", tone: "teal", status: "IN_PROGRESS" }],
  ago = "Just now",
  showTranscript = true,
  raised = true,
  style,
}: Readonly<{
  ms?: number;
  durationMs?: number;
  author?: string;
  authorTone?: AvatarTone;
  audience?: AudienceChipKind[];
  transcript?: string;
  assignments?: Assignment[];
  ago?: string;
  showTranscript?: boolean;
  raised?: boolean;
  style?: CSSProperties;
}>) {
  return (
    <div
      className="relative rounded-xl"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: 14,
        boxShadow: raised
          ? "0 20px 50px -25px oklch(0 0 0 / 0.25), 0 2px 6px -2px oklch(0 0 0 / 0.06)"
          : "none",
        ...style,
      }}
    >
      <span
        aria-hidden
        className="absolute left-0"
        style={{
          top: 12,
          bottom: 12,
          width: 3,
          borderRadius: "0 3px 3px 0",
          background: "var(--note-voice-accent)",
        }}
      />
      <div className="mb-2.5 flex items-center gap-2">
        <TimestampPill ms={ms} accent="voice" />
        <span
          className="inline-flex items-center gap-1 font-semibold"
          style={{
            color: "var(--note-voice-accent)",
            fontSize: 10.5,
          }}
        >
          <Mic className="size-3" /> Voice note
        </span>
        <div className="flex-1" />
        <span
          className="text-muted-foreground"
          style={{ fontSize: 10.5 }}
        >
          {ago}
        </span>
      </div>
      <div className="mb-2.5 flex items-center gap-2.5">
        <LandingAvatar
          initials={initialsFromName(author)}
          tone={authorTone}
          size={26}
        />
        <div className="font-bold" style={{ fontSize: 12.5 }}>
          {author}
        </div>
      </div>
      <div
        className="flex items-center gap-2.5 rounded-lg"
        style={{
          background: "var(--note-voice-bg)",
          padding: "8px 10px",
          border:
            "1px solid color-mix(in oklch, var(--note-voice-accent) 22%, transparent)",
        }}
      >
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center justify-center rounded-full text-white"
          style={{
            width: 28,
            height: 28,
            background: "var(--note-voice-accent)",
          }}
        >
          <Play className="size-3" fill="currentColor" strokeWidth={0} />
        </span>
        <div
          className="flex flex-1 items-center"
          style={{ gap: 2, height: 22 }}
        >
          {WAVEFORM.map((bar) => (
            <span
              key={bar.id}
              aria-hidden
              className="shrink-0 rounded-sm"
              style={{
                width: 2.5,
                height: bar.height,
                background: bar.filled
                  ? "var(--note-voice-accent)"
                  : "color-mix(in oklch, var(--note-voice-accent) 28%, transparent)",
              }}
            />
          ))}
        </div>
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 10.5,
            color:
              "color-mix(in oklch, var(--note-voice-accent) 80%, var(--foreground))",
          }}
        >
          {formatNoteTimestamp(durationMs)}
        </span>
      </div>
      {showTranscript && transcript ? (
        <div
          className="mt-2.5 rounded-lg italic text-muted-foreground"
          style={{
            padding: "9px 11px",
            background: "var(--surface-sunken)",
            fontSize: 12,
            lineHeight: 1.45,
            textWrap: "pretty",
          }}
        >
          <span
            className="mr-1.5 inline-block font-bold not-italic tracking-wider text-foreground uppercase"
            style={{ fontSize: 9.5 }}
          >
            Transcript
          </span>
          &ldquo;{transcript}&rdquo;
        </div>
      ) : null}
      {audience?.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {audience.map((a) => (
            <AudienceChip
              key={
                a.kind === "EVERYONE" ? "EVERYONE" : `${a.kind}-${a.label}`
              }
              {...a}
            />
          ))}
        </div>
      ) : null}
      {assignments?.length ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5 pt-3"
          style={{ borderTop: "1px dashed var(--border)" }}
        >
          <span
            className="mr-1 font-bold tracking-wider text-muted-foreground uppercase"
            style={{ fontSize: 9.5 }}
          >
            Assigned
          </span>
          {assignments.map((a) => (
            <AssigneePip key={a.initials} {...a} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

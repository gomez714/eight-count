import { Mic, Type as TextIcon } from "lucide-react";
import type { CSSProperties } from "react";

import {
  type LandingStatus,
  StatusChip,
  TagChip,
  TimestampPill,
} from "./chips";

export type DancerQueueRow = {
  ms: number;
  type: "TEXT" | "VOICE";
  body: string;
  status: LandingStatus;
  tag?: string;
};

const DEFAULT_ROWS: DancerQueueRow[] = [
  {
    ms: 14500,
    type: "TEXT",
    body: "Arms early on the 5-and. Hold until the snap.",
    status: "IN_PROGRESS",
    tag: "Timing",
  },
  {
    ms: 47000,
    type: "VOICE",
    body: "Second pirouette — spot the back wall, not the camera.",
    status: "OPEN",
    tag: "Technique",
  },
  {
    ms: 72400,
    type: "TEXT",
    body: "Count the &-a-7. Plant on 7, breathe on 8.",
    status: "ADDRESSED",
    tag: "Musicality",
  },
  {
    ms: 122300,
    type: "TEXT",
    body: "Bridge transition: review w/ back line at next call.",
    status: "OPEN",
    tag: "Formation",
  },
];

export function LandingDancerQueueCard({
  rows = DEFAULT_ROWS,
  header = true,
  forName = "Iris",
  projectName = "Spring Showcase",
  openCount,
  raised = true,
  style,
}: Readonly<{
  rows?: DancerQueueRow[];
  header?: boolean;
  forName?: string;
  projectName?: string;
  openCount?: number;
  raised?: boolean;
  style?: CSSProperties;
}>) {
  const resolvedOpenCount =
    openCount ??
    rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS")
      .length;

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface-canvas)",
        border: "1px solid var(--border)",
        boxShadow: raised
          ? "0 22px 60px -25px oklch(0 0 0 / 0.3), 0 3px 8px -3px oklch(0 0 0 / 0.06)"
          : "none",
        ...style,
      }}
    >
      {header ? (
        <div
          style={{
            padding: "13px 14px",
            borderBottom: "1px solid var(--border)",
            background: "var(--card)",
          }}
        >
          <div
            className="font-bold tracking-wider text-muted-foreground uppercase"
            style={{ fontSize: 10.5 }}
          >
            For you, {forName}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-bold" style={{ fontSize: 18, letterSpacing: -0.3 }}>
              {resolvedOpenCount} open {resolvedOpenCount === 1 ? "note" : "notes"}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: 11.5 }}>
              · {projectName}
            </span>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={`${r.ms}-${r.type}`}
            className="relative flex gap-2.5"
            style={{
              padding: "11px 14px",
              borderBottom:
                i < rows.length - 1 ? "1px solid var(--border)" : "none",
              background: "var(--card)",
            }}
          >
            <span
              aria-hidden
              className="absolute left-0"
              style={{
                top: 14,
                bottom: 14,
                width: 2.5,
                background:
                  r.type === "VOICE"
                    ? "var(--note-voice-accent)"
                    : "var(--primary)",
              }}
            />
            <div
              className="flex flex-col items-start gap-1"
              style={{ minWidth: 54 }}
            >
              <TimestampPill
                ms={r.ms}
                accent={r.type === "VOICE" ? "voice" : "primary"}
                size="sm"
              />
              <span
                className="inline-flex items-center gap-1 text-muted-foreground"
                style={{ fontSize: 9.5 }}
              >
                {r.type === "VOICE" ? (
                  <>
                    <Mic className="size-2.5" /> Voice
                  </>
                ) : (
                  <>
                    <TextIcon className="size-2.5" /> Text
                  </>
                )}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="m-0 text-foreground"
                style={{
                  fontSize: 12,
                  lineHeight: 1.4,
                  textWrap: "pretty",
                }}
              >
                {r.body}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusChip status={r.status} />
                {r.tag ? <TagChip label={r.tag} /> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

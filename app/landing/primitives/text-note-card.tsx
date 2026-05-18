import type { CSSProperties } from "react";

import { LandingAvatar, type AvatarTone } from "./avatar-initials";
import {
  AssigneePip,
  AudienceChip,
  type AudienceChipKind,
  type LandingStatus,
  TagChip,
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

export function LandingTextNoteCard({
  ms = 14500,
  body = "Front line — your arms are early on the 5-and. Hold until the snap, then release with the line.",
  author = "Maya R.",
  authorRole = "Instructor",
  authorTone = "teal",
  audience = [{ kind: "GROUP", label: "Front line", count: 4 }],
  assignments = [
    { initials: "IT", tone: "teal", status: "ADDRESSED" },
    { initials: "JL", tone: "coral", status: "IN_PROGRESS" },
    { initials: "BP", tone: "olive", status: "OPEN" },
    { initials: "AK", tone: "plum", status: "OPEN" },
  ],
  tag = "Timing",
  ago = "3 min ago",
  raised = true,
  style,
}: Readonly<{
  ms?: number;
  body?: string;
  author?: string;
  authorRole?: string;
  authorTone?: AvatarTone;
  audience?: AudienceChipKind[];
  assignments?: Assignment[];
  tag?: string | null;
  ago?: string;
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
          background: "var(--primary)",
        }}
      />
      <div className="mb-2.5 flex items-center gap-2">
        <TimestampPill ms={ms} accent="primary" />
        {tag ? <TagChip label={tag} /> : null}
        <div className="flex-1" />
        <span
          className="text-muted-foreground"
          style={{ fontSize: 10.5 }}
        >
          {ago}
        </span>
      </div>
      <div className="flex items-start gap-2.5">
        <LandingAvatar
          initials={initialsFromName(author)}
          tone={authorTone}
          size={26}
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="font-bold" style={{ fontSize: 12.5 }}>
              {author}
            </span>
            <span
              className="text-muted-foreground"
              style={{ fontSize: 10.5 }}
            >
              {authorRole}
            </span>
          </div>
          <p
            className="text-foreground"
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.45,
              textWrap: "pretty",
            }}
          >
            {body}
          </p>
          {audience?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
        </div>
      </div>
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

import { Repeat } from "lucide-react";

import { MiniChip } from "./chips";
import { LandingTextNoteCard } from "./text-note-card";
import { LandingVideoFrame } from "./video-frame";
import { LandingVoiceNoteCard } from "./voice-note-card";

/**
 * The hero collage — a layered, rotated composition of product surfaces
 * meant to read as "an editorial spread of the app" rather than a literal
 * screenshot. Used in the desktop hero. Designed to live inside a parent
 * that gives it a minimum height (the rotated cards bleed outside the
 * natural flow box and would otherwise collapse the container).
 */
export function LandingProductCollageHero() {
  return (
    <div
      className="relative w-full"
      style={{ minHeight: 540 }}
      aria-label="Eight Count product preview — rehearsal video with notes and voice notes layered on top"
      role="img"
    >
      {/* Cinema video frame — base layer, slight tilt left */}
      <div
        className="absolute"
        style={{
          top: "6%",
          right: "2%",
          bottom: "16%",
          left: "2%",
          transform: "rotate(-1deg)",
        }}
      >
        <LandingVideoFrame
          variant="cinema"
          notes={[
            { ms: 14500 },
            { ms: 47000, type: "VOICE" },
            { ms: 72400 },
            { ms: 98700, type: "VOICE" },
            { ms: 122300 },
          ]}
        />
      </div>

      {/* Voice note — top right, tilted slightly right */}
      <div
        className="absolute"
        style={{
          top: "-2%",
          right: "-4%",
          width: 280,
          transform: "rotate(2deg)",
        }}
      >
        <LandingVoiceNoteCard
          showTranscript={false}
          audience={[{ kind: "USER", label: "Iris T." }]}
          assignments={[
            { initials: "IT", tone: "teal", status: "IN_PROGRESS" },
          ]}
        />
      </div>

      {/* Text note — bottom left, tilted more dramatically */}
      <div
        className="absolute z-10"
        style={{
          bottom: "-3%",
          left: "-6%",
          width: 300,
          transform: "rotate(-3deg)",
        }}
      >
        <LandingTextNoteCard
          assignments={[
            { initials: "IT", tone: "teal", status: "ADDRESSED" },
            { initials: "JL", tone: "coral", status: "IN_PROGRESS" },
            { initials: "BP", tone: "olive", status: "OPEN" },
          ]}
          audience={[{ kind: "GROUP", label: "Front line", count: 4 }]}
        />
      </div>

      {/* Repeating chip floater — right side, big tilt */}
      <div
        className="absolute"
        style={{
          top: "48%",
          right: "-4%",
          transform: "rotate(5deg)",
        }}
      >
        <MiniChip
          icon={
            <Repeat
              className="size-3"
              style={{ color: "var(--repeating-fg)" }}
            />
          }
          label={
            <span style={{ color: "var(--repeating-fg)" }}>
              Repeating × 3
            </span>
          }
        />
      </div>

      {/* Yellow highlighter tape accent — pure decoration */}
      <span
        aria-hidden
        className="absolute"
        style={{
          top: "6%",
          left: "32%",
          width: 60,
          height: 16,
          background: "oklch(0.96 0.06 75 / 0.55)",
          transform: "rotate(-6deg)",
          borderRadius: 1,
          boxShadow: "0 1px 2px oklch(0 0 0 / 0.06)",
        }}
      />
    </div>
  );
}

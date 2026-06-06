import { Play } from "lucide-react";
import type { CSSProperties } from "react";

import { formatNoteTimestamp } from "@/lib/notes/format";
import { cn } from "@/lib/utils";

/**
 * Cinema-tinted video frame placeholder. Stands in for a real captured
 * frame at the note's timestamp until server-side frame extraction lands
 * (see "Frame extraction strategy" decision — placeholder for v1).
 *
 * Five scene variants of stick-figure silhouettes give the feed visual
 * texture without committing to any specific dancer or pose. Scene is
 * picked deterministically from the rehearsal+timestamp so the same note
 * always shows the same frame.
 *
 * `tone` switches the spotlight tint between teal (text notes) and coral
 * (voice notes). `caption` controls whether the timestamp pill renders
 * inside the frame (true for activity-row thumbs, false for backdrops
 * where the timestamp lives in the overlay text).
 */

type Tone = "teal" | "coral";

type Figure = { x: number; h: number; lean: number };

const SCENES: ReadonlyArray<ReadonlyArray<Figure>> = [
  // 4 dancers, stage-wide
  [
    { x: 70, h: 78, lean: 12 },
    { x: 120, h: 70, lean: -8 },
    { x: 175, h: 82, lean: 6 },
    { x: 232, h: 66, lean: -14 },
  ],
  // soloist + flank
  [
    { x: 150, h: 96, lean: 0 },
    { x: 96, h: 60, lean: 18 },
    { x: 210, h: 58, lean: -18 },
  ],
  // trio
  [
    { x: 84, h: 72, lean: -10 },
    { x: 150, h: 88, lean: 4 },
    { x: 220, h: 74, lean: 14 },
  ],
  // soloist
  [{ x: 160, h: 104, lean: 2 }],
  // 5-dancer line
  [
    { x: 60, h: 64, lean: 20 },
    { x: 110, h: 76, lean: 8 },
    { x: 165, h: 70, lean: -6 },
    { x: 215, h: 80, lean: -16 },
    { x: 260, h: 62, lean: 10 },
  ],
];

const TONE_SPOT: Record<Tone, string> = {
  teal: "var(--primary)",
  coral: "var(--note-voice-accent)",
};

type FrameThumbProps = {
  /** Combined with `ms` to deterministically pick a scene variant. */
  rehearsalId: string;
  /** Timestamp shown in the pill (ms). */
  ms: number;
  /** Spotlight tint. Defaults to teal. */
  tone?: Tone;
  /** Whether to render the bottom-left timestamp pill. Defaults to true. */
  caption?: boolean;
  /** Aspect ratio CSS string. Defaults to `16 / 9`. */
  aspect?: string;
  /** When true, fills its parent (used as a backdrop for the pin card). */
  fill?: boolean;
  /** Visually dim the scene (used for the "low-light frame" degraded state). */
  degraded?: boolean;
  className?: string;
};

export function FrameThumb({
  rehearsalId,
  ms,
  tone = "teal",
  caption = true,
  aspect = "16 / 9",
  fill = false,
  degraded = false,
  className,
}: Readonly<FrameThumbProps>) {
  // Stable seed → stable scene per (rehearsal, timestamp).
  const seed = hashSeed(`${rehearsalId}:${Math.floor(ms / 1000)}`);
  const scene = SCENES[seed % SCENES.length];
  const figureOpacity = degraded ? 0.18 : 0.34;
  const spotOpacity = degraded ? 0.06 : 0.14;

  const wrapStyle: CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        background: "var(--cinema-bg)",
      }
    : {
        position: "relative",
        width: "100%",
        aspectRatio: aspect,
        background: "var(--cinema-bg)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--cinema-border)",
      };

  return (
    <div
      aria-hidden
      role="img"
      aria-label="Video frame placeholder"
      className={cn(className)}
      style={wrapStyle}
    >
      <svg
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <radialGradient id={`spot-${seed}`} cx="50%" cy="35%" r="60%">
            <stop
              offset="0%"
              stopColor={TONE_SPOT[tone]}
              stopOpacity={spotOpacity}
            />
            <stop offset="100%" stopColor="var(--cinema-bg)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="180" fill={`url(#spot-${seed})`} />
        {scene.map((f, i) => (
          <Figure key={i} figure={f} opacity={figureOpacity} />
        ))}
      </svg>

      {caption ? (
        <span
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 7px",
            borderRadius: 999,
            background: "color-mix(in oklch, var(--cinema-bg) 30%, transparent)",
            backdropFilter: "blur(6px)",
            color: "var(--cinema-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <Play
            className="h-2.5 w-2.5"
            fill="currentColor"
            strokeWidth={0}
          />
          {formatNoteTimestamp(ms)}
        </span>
      ) : null}

      {degraded ? (
        <span
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 8px",
            borderRadius: 999,
            background: "color-mix(in oklch, var(--cinema-bg) 40%, transparent)",
            backdropFilter: "blur(6px)",
            color: "var(--cinema-muted)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Low-light frame
        </span>
      ) : null}
    </div>
  );
}

function Figure({
  figure,
  opacity,
}: Readonly<{ figure: Figure; opacity: number }>) {
  const headR = Math.max(4, Math.round(figure.h * 0.08));
  const headY = 130 - figure.h;
  const torsoBottom = 130 - Math.round(figure.h * 0.35);
  const lean = figure.lean * 0.5;
  return (
    <g
      stroke="var(--cinema-muted)"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity={opacity}
      transform={`rotate(${lean} ${figure.x} 130)`}
    >
      <circle
        cx={figure.x}
        cy={headY}
        r={headR}
        fill="var(--cinema-muted)"
        stroke="none"
      />
      <line
        x1={figure.x}
        y1={headY + headR}
        x2={figure.x}
        y2={torsoBottom}
      />
      <line
        x1={figure.x - 12}
        y1={headY + headR + 14}
        x2={figure.x + 12}
        y2={headY + headR + 14}
      />
      <line x1={figure.x} y1={torsoBottom} x2={figure.x - 10} y2={130} />
      <line x1={figure.x} y1={torsoBottom} x2={figure.x + 10} y2={130} />
    </g>
  );
}

function hashSeed(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h) ^ (input.codePointAt(i) ?? 0);
  }
  return Math.abs(h);
}

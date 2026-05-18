import { Play } from "lucide-react";

import { LandingPhoneFrame } from "./phone-frame";
import { LandingVideoFrame } from "./video-frame";

const PHONE_WAVEFORM = Array.from({ length: 18 }, (_, i) => ({
  id: `peek-bar-${i}`,
  filled: i < 7,
  height: 4 + Math.abs(Math.sin(i * 0.7) * 11),
}));

/**
 * Mobile-only hero composition. Replaces the desktop `LandingProductCollageHero`
 * below the `sm:` breakpoint. Three stacked layers:
 *   - Cinema video frame as the back layer (tilt -2deg)
 *   - Phone bezel overlapping bottom-right (tilt +5deg) with a compact
 *     dancer-queue screen inside — shows what dancers actually see
 *   - A small voice-note pill peeking bottom-left (tilt -3deg) to hint at
 *     voice-sync playback
 *
 * Heights / positions are fixed pixel values that target the ~360px tall
 * art-zone below the CTAs. Don't make this a flex parent — the rotated
 * children rely on absolute positioning.
 */
export function LandingMobileHero() {
  return (
    <div
      className="relative mt-2 overflow-hidden"
      style={{ height: 360 }}
      aria-label="Eight Count product preview — rehearsal video with a dancer's phone view and voice note"
      role="img"
    >
      {/* Video frame — back layer */}
      <div
        className="absolute"
        style={{
          top: 26,
          left: 16,
          right: 16,
          transform: "rotate(-2deg)",
        }}
      >
        <LandingVideoFrame
          variant="cinema"
          notes={[
            { ms: 14500 },
            { ms: 47000, type: "VOICE" },
            { ms: 98700 },
          ]}
        />
      </div>

      {/* Phone bezel — overlapping bottom-right */}
      <div
        className="absolute"
        style={{
          right: 18,
          bottom: -34,
          transform: "rotate(5deg)",
          zIndex: 3,
        }}
      >
        <LandingPhoneFrame width={170}>
          <PhoneDancerScreen />
        </LandingPhoneFrame>
      </div>

      {/* Voice-note peek pill — overlapping bottom-left */}
      <div
        className="absolute"
        style={{
          left: 6,
          bottom: 22,
          width: 220,
          transform: "rotate(-3deg)",
          zIndex: 4,
        }}
      >
        <div
          className="flex items-center gap-2 rounded-xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            padding: "9px 10px",
            boxShadow: "0 14px 30px -16px oklch(0 0 0 / 0.25)",
          }}
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-full text-white"
            style={{
              width: 22,
              height: 22,
              background: "var(--note-voice-accent)",
            }}
          >
            <Play className="size-2.5" fill="currentColor" strokeWidth={0} />
          </span>
          <div
            className="flex flex-1 items-center"
            style={{ gap: 1.5, height: 16 }}
          >
            {PHONE_WAVEFORM.map((bar) => (
              <span
                key={bar.id}
                aria-hidden
                className="rounded-sm"
                style={{
                  width: 2,
                  height: bar.height,
                  background: bar.filled
                    ? "var(--note-voice-accent)"
                    : "color-mix(in oklch, var(--note-voice-accent) 30%, transparent)",
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: 9.5,
              color: "var(--note-voice-accent)",
            }}
          >
            0:11
          </span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Phone screen content — compact dancer-queue view that fits inside the 170px
// phone bezel. Kept inline here because it's a one-off visual that only makes
// sense in this composition.
// ----------------------------------------------------------------------------

type PhoneRow = {
  id: string;
  ms: number;
  body: string;
  tag: string;
  status: "OPEN" | "IN_PROGRESS" | "ADDRESSED";
};

const PHONE_ROWS: PhoneRow[] = [
  {
    id: "row-1",
    ms: 14500,
    body: "Arms early on the 5-and.",
    tag: "Timing",
    status: "IN_PROGRESS",
  },
  {
    id: "row-2",
    ms: 47000,
    body: "Spot back wall, not camera.",
    tag: "Technique",
    status: "OPEN",
  },
  {
    id: "row-3",
    ms: 72400,
    body: "Plant on 7, breathe on 8.",
    tag: "Musicality",
    status: "ADDRESSED",
  },
];

const STATUS_DOT_COLOR: Record<PhoneRow["status"], string> = {
  OPEN: "var(--status-open-fg)",
  IN_PROGRESS: "var(--status-progress-fg)",
  ADDRESSED: "var(--status-addressed-fg)",
};

function PhoneDancerScreen() {
  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--surface-canvas)" }}
    >
      {/* Fake status bar so the phone reads as "in use" */}
      <div
        className="flex items-center justify-between"
        style={{
          paddingTop: 14,
          paddingRight: 14,
          paddingBottom: 4,
          paddingLeft: 14,
          fontFamily: "var(--font-geist-mono)",
          fontSize: 9,
          color: "var(--foreground)",
          fontWeight: 600,
        }}
      >
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span
            aria-hidden
            style={{
              width: 12,
              height: 5,
              background: "var(--foreground)",
              borderRadius: 1.5,
            }}
          />
        </div>
      </div>

      {/* Compact header */}
      <div
        style={{
          padding: "8px 11px 6px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="font-bold tracking-wider uppercase text-muted-foreground"
          style={{ fontSize: 7.5 }}
        >
          For you, Iris
        </div>
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="font-bold" style={{ fontSize: 13 }}>
            3 open
          </span>
          <span
            className="text-muted-foreground"
            style={{ fontSize: 8.5 }}
          >
            · Spring Showcase
          </span>
        </div>
      </div>

      {/* Compact queue rows */}
      <div className="flex flex-col">
        {PHONE_ROWS.map((row, i) => (
          <div
            key={row.id}
            className="relative flex flex-col gap-1"
            style={{
              padding: "7px 11px",
              borderBottom:
                i < PHONE_ROWS.length - 1
                  ? "1px solid var(--border)"
                  : "none",
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="rounded-sm font-bold"
                style={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: 8.5,
                  padding: "1px 4px",
                  background:
                    "color-mix(in oklch, var(--primary) 12%, transparent)",
                  color: "var(--primary)",
                }}
              >
                {Math.floor(row.ms / 60000)}:
                {String(Math.floor((row.ms / 1000) % 60)).padStart(2, "0")}
              </span>
              <span
                className="text-muted-foreground"
                style={{ fontSize: 7, letterSpacing: 0.3 }}
              >
                {row.tag.toUpperCase()}
              </span>
            </div>
            <p
              className="m-0 text-foreground"
              style={{
                fontSize: 9.5,
                lineHeight: 1.3,
                textWrap: "pretty",
              }}
            >
              {row.body}
            </p>
            <div className="flex items-center gap-1">
              <span
                aria-hidden
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: STATUS_DOT_COLOR[row.status],
                }}
              />
              <span
                className="text-muted-foreground"
                style={{ fontSize: 8 }}
              >
                {row.status === "OPEN"
                  ? "Open"
                  : row.status === "IN_PROGRESS"
                    ? "In progress"
                    : "Addressed"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

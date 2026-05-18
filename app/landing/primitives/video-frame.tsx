import { Play } from "lucide-react";

import { formatNoteTimestamp } from "@/lib/notes/format";

export type VideoNoteMarker = {
  ms: number;
  type?: "TEXT" | "VOICE";
};

type VideoFrameVariant = "default" | "cinema";

export function LandingVideoFrame({
  currentMs = 47000,
  durationMs = 196000,
  notes = [],
  variant = "default",
  caption = "rehearsal_2026_05_01.mp4",
  showChrome = true,
  silhouettesCount = 5,
}: Readonly<{
  currentMs?: number;
  durationMs?: number;
  notes?: VideoNoteMarker[];
  variant?: VideoFrameVariant;
  caption?: string;
  showChrome?: boolean;
  silhouettesCount?: number;
}>) {
  const pct = (currentMs / durationMs) * 100;
  const dancers: { x: number; h: number; lift: number }[] = [];
  for (let i = 0; i < silhouettesCount; i++) {
    const x = 40 + i * (260 / Math.max(1, silhouettesCount - 1));
    const h = 60 + ((i * 7) % 20);
    dancers.push({ x, h, lift: i % 2 ? 8 : -2 });
  }

  const isCinema = variant === "cinema";

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "16 / 9",
        borderRadius: isCinema ? 12 : 10,
        background: "#0b0d11",
        border: isCinema ? "none" : "1px solid var(--border)",
        boxShadow: isCinema
          ? "0 30px 80px -20px oklch(0 0 0 / 0.5)"
          : "0 1px 2px oklch(0 0 0 / 0.06)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 40% 30%, oklch(0.28 0.04 240) 0%, oklch(0.1 0.02 240) 70%), repeating-linear-gradient(135deg, transparent 0 24px, oklch(1 0 0 / 0.02) 24px 25px)",
        }}
      />
      {/* floor light */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 left-0"
        style={{
          height: "55%",
          background:
            "radial-gradient(ellipse at 50% 95%, oklch(0.55 0.05 220 / 0.35) 0%, transparent 60%)",
        }}
      />
      {/* dancers */}
      <svg
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-0 h-full w-full opacity-65"
        aria-hidden
      >
        {dancers.map((d, i) => (
          <g key={d.x} fill="oklch(0.85 0.02 230 / 0.7)" stroke="none">
            <circle cx={d.x} cy={170 - d.h + d.lift} r="4.4" />
            <rect
              x={d.x - 5}
              y={170 - d.h + 6 + d.lift}
              width="10"
              height={d.h - 6}
              rx="2.5"
            />
            <rect
              x={d.x - 12}
              y={170 - d.h + 14 + d.lift}
              width="5.5"
              height="20"
              rx="2"
              transform={`rotate(${
                i % 2 ? -12 : 14
              } ${d.x} ${170 - d.h + 20 + d.lift})`}
            />
            <rect
              x={d.x + 7}
              y={170 - d.h + 14 + d.lift}
              width="5.5"
              height="20"
              rx="2"
              transform={`rotate(${
                i % 2 ? 16 : -10
              } ${d.x} ${170 - d.h + 20 + d.lift})`}
            />
          </g>
        ))}
      </svg>
      {showChrome ? (
        <>
          <div
            className="absolute inline-flex items-center gap-1.5 rounded-full font-medium text-white"
            style={{
              top: "6%",
              left: "5%",
              fontSize: 10.5,
              padding: "4px 9px",
              background: "oklch(0 0 0 / 0.45)",
              backdropFilter: "blur(6px)",
            }}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full"
              style={{ background: "#ef4444" }}
            />
            {caption}
          </div>
          <div
            className="absolute rounded-full text-white"
            style={{
              top: "6%",
              right: "5%",
              fontSize: 10.5,
              padding: "4px 9px",
              background: "oklch(0 0 0 / 0.45)",
              backdropFilter: "blur(6px)",
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            {formatNoteTimestamp(currentMs)} /{" "}
            {formatNoteTimestamp(durationMs)}
          </div>
          {/* center play */}
          <span
            aria-hidden
            className="absolute inline-flex items-center justify-center rounded-full"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "12%",
              aspectRatio: "1",
              background: "oklch(1 0 0 / 0.94)",
              color: "var(--foreground)",
              boxShadow: "0 6px 18px oklch(0 0 0 / 0.4)",
            }}
          >
            <Play
              className="size-[36%]"
              fill="currentColor"
              strokeWidth={0}
            />
          </span>
        </>
      ) : null}
      {/* timeline overlay */}
      <div
        className="absolute flex items-center gap-2.5"
        style={{ left: "5%", right: "5%", bottom: "6%" }}
      >
        <div
          className="relative h-1 flex-1 rounded-full"
          style={{ background: "oklch(1 0 0 / 0.2)" }}
        >
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full opacity-85"
            style={{ width: `${pct}%`, background: "white" }}
          />
          {notes.map((n) => {
            const left = (n.ms / durationMs) * 100;
            const isVoice = n.type === "VOICE";
            return (
              <span
                key={`${n.ms}-${n.type ?? "TEXT"}`}
                aria-hidden
                className="absolute"
                style={{
                  left: `${left}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: isVoice
                    ? "var(--note-voice-accent)"
                    : "var(--primary)",
                  border: "1.5px solid white",
                  boxShadow: "0 1px 2px oklch(0 0 0 / 0.4)",
                }}
              />
            );
          })}
          <span
            aria-hidden
            className="absolute size-3 rounded-full"
            style={{
              left: `${pct}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: "white",
              boxShadow: "0 2px 4px oklch(0 0 0 / 0.4)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

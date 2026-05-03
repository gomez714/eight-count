import { Mic, Play } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";

// Decorative-only waveform (matches the real VoiceNotePlayer aesthetic).
const WAVEFORM_BARS = Array.from(
  { length: 32 },
  (_, i) => 35 + Math.abs(Math.sin(i * 0.7)) * 50 + (i % 3) * 5
);
// Filled portion of the waveform — illustrative "in-progress playback" look.
const FILLED_BARS = 13;

type RecipientStatus = "OPEN" | "IN_PROGRESS";

const STATUS_LABELS: Record<RecipientStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
};

const STATUS_TOKENS: Record<
  RecipientStatus,
  { bg: string; fg: string; border: string }
> = {
  OPEN: {
    bg: "var(--status-open-bg)",
    fg: "var(--status-open-fg)",
    border: "var(--status-open-border)",
  },
  IN_PROGRESS: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
  },
};

const RECIPIENTS: Array<{
  initials: string;
  status: RecipientStatus;
  toneSeed: string;
}> = [
  { initials: "TC", status: "IN_PROGRESS", toneSeed: "mockup-tc" },
  { initials: "LM", status: "OPEN", toneSeed: "mockup-lm" },
  { initials: "JR", status: "IN_PROGRESS", toneSeed: "mockup-jr" },
];

/**
 * Static, illustrative note-card mockup for the landing page hero.
 * Mirrors the real workspace NoteRow vocabulary (coral voice accent,
 * timestamp pill, voice player pill, audience chip, recipient status
 * chips) without leaking real user data — initials only, no names.
 */
export function NoteMockup() {
  return (
    <article
      role="img"
      aria-label="Example note: a voice note for the front line, recorded at two minutes and fourteen seconds, with three dancers assigned"
      className="relative grid grid-cols-[80px_1fr] gap-4 overflow-hidden rounded-lg border bg-card p-4 pl-3.5 shadow-sm sm:p-5 sm:pl-4"
    >
      <span
        aria-hidden
        className="absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-r"
        style={{ backgroundColor: "var(--note-voice-accent)" }}
      />

      <div className="flex flex-col items-start gap-1">
        <span
          className="rounded-md px-2 py-1 font-mono text-sm font-semibold"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--note-voice-accent) 12%, transparent)",
            color: "var(--foreground)",
          }}
        >
          02:14
        </span>
        <span className="inline-flex items-center gap-1 pl-2 text-[10.5px] text-muted-foreground">
          <Mic aria-hidden className="size-2.5" />
          Voice
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="text-sm font-semibold">You</div>

        <div
          className="flex items-center gap-2.5 rounded-md border px-3 py-2"
          style={{
            backgroundColor: "var(--note-voice-bg)",
            borderColor:
              "color-mix(in oklch, var(--note-voice-accent) 22%, transparent)",
          }}
        >
          <span
            aria-hidden
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
            style={{ backgroundColor: "var(--note-voice-accent)" }}
          >
            <Play className="size-3 fill-current" />
          </span>

          <div aria-hidden className="flex h-5 flex-1 items-center gap-px">
            {WAVEFORM_BARS.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-[1px]"
                style={{
                  height: `${h}%`,
                  backgroundColor:
                    i < FILLED_BARS
                      ? "var(--note-voice-accent)"
                      : "color-mix(in oklch, var(--note-voice-accent) 28%, transparent)",
                }}
              />
            ))}
          </div>

          <span
            className="shrink-0 font-mono text-[11px] tabular-nums"
            style={{
              color:
                "color-mix(in oklch, var(--note-voice-accent) 78%, var(--foreground))",
            }}
          >
            0:08
          </span>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          To: Front line
        </span>

        <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
          <span className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
            Assigned
          </span>
          {RECIPIENTS.map((recipient) => {
            const tokens = STATUS_TOKENS[recipient.status];
            return (
              <span
                key={recipient.initials}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: tokens.bg,
                  color: tokens.fg,
                  borderColor: tokens.border,
                }}
              >
                <AvatarInitials
                  name={recipient.initials}
                  toneSeed={recipient.toneSeed}
                  size={16}
                />
                <span className="font-medium">{recipient.initials}</span>
                <span
                  aria-hidden
                  className="inline-block size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: tokens.fg }}
                />
                <span className="font-semibold">
                  {STATUS_LABELS[recipient.status]}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </article>
  );
}

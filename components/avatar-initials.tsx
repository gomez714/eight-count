import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type AvatarTone = "neutral" | "teal" | "coral" | "olive" | "plum";

const TONE_PALETTE: Record<AvatarTone, { bg: string; fg: string }> = {
  neutral: {
    bg: "var(--avatar-tone-neutral-bg)",
    fg: "var(--avatar-tone-neutral-fg)",
  },
  teal: {
    bg: "var(--avatar-tone-teal-bg)",
    fg: "var(--avatar-tone-teal-fg)",
  },
  coral: {
    bg: "var(--avatar-tone-coral-bg)",
    fg: "var(--avatar-tone-coral-fg)",
  },
  olive: {
    bg: "var(--avatar-tone-olive-bg)",
    fg: "var(--avatar-tone-olive-fg)",
  },
  plum: {
    bg: "var(--avatar-tone-plum-bg)",
    fg: "var(--avatar-tone-plum-fg)",
  },
};

const ORDERED_TONES: AvatarTone[] = ["teal", "coral", "olive", "plum"];

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ (input.codePointAt(i) ?? 0);
  }
  return Math.abs(hash);
}

export function pickAvatarTone(id: string | null | undefined): AvatarTone {
  if (!id) return "neutral";
  const index = hashString(id) % ORDERED_TONES.length;
  return ORDERED_TONES[index];
}

function pickInitials(name: string | null | undefined, fallback: string | null | undefined): string {
  const source = (name ?? fallback ?? "").trim();
  if (!source) return "??";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const last = parts.at(-1) ?? parts[0];
  return (parts[0][0] + last[0]).toUpperCase();
}

type AvatarInitialsProps = {
  name: string | null | undefined;
  /** Optional fallback (e.g. email) used when `name` is empty. */
  fallback?: string | null;
  /** Stable id used to pick a deterministic tone (typically `userId`). */
  toneSeed?: string | null;
  /** Explicit tone override; takes precedence over `toneSeed`. */
  tone?: AvatarTone;
  size?: number;
  className?: string;
};

export function AvatarInitials({
  name,
  fallback,
  toneSeed,
  tone,
  size = 24,
  className,
}: Readonly<AvatarInitialsProps>) {
  const resolvedTone = tone ?? pickAvatarTone(toneSeed ?? name ?? fallback);
  const palette = TONE_PALETTE[resolvedTone];
  const initials = pickInitials(name, fallback);

  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: palette.bg,
    color: palette.fg,
    fontSize: Math.max(10, Math.round(size * 0.36)),
  };

  return (
    <span
      aria-hidden
      data-tone={resolvedTone}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none",
        className
      )}
      style={style}
    >
      {initials}
    </span>
  );
}

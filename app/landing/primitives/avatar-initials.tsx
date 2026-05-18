import type { CSSProperties } from "react";

export type AvatarTone = "teal" | "coral" | "olive" | "plum" | "sand" | "slate";

const TONE_TOKENS: Record<AvatarTone, { bg: string; fg: string }> = {
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
  sand: {
    bg: "oklch(0.93 0.03 70)",
    fg: "oklch(0.4 0.07 60)",
  },
  slate: {
    bg: "var(--avatar-tone-neutral-bg)",
    fg: "var(--avatar-tone-neutral-fg)",
  },
};

export function LandingAvatar({
  initials,
  tone = "slate",
  size = 22,
  style,
}: Readonly<{
  initials: string;
  tone?: AvatarTone;
  size?: number;
  style?: CSSProperties;
}>) {
  const tokens = TONE_TOKENS[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: tokens.bg,
        color: tokens.fg,
        fontSize: Math.max(9, size * 0.42),
        letterSpacing: 0.2,
        ...style,
      }}
    >
      {initials}
    </span>
  );
}

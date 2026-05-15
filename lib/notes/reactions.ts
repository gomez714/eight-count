export const REACTION_KINDS = ["ACKNOWLEDGE", "QUESTION", "ENCOURAGE"] as const

export type ReactionKind = (typeof REACTION_KINDS)[number]

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  ACKNOWLEDGE: "👍",
  QUESTION: "🙋",
  ENCOURAGE: "❤️",
}

export const REACTION_LABELS: Record<ReactionKind, string> = {
  ACKNOWLEDGE: "Acknowledge",
  QUESTION: "Question",
  ENCOURAGE: "Encouragement",
}

export const REACTION_DESCRIPTIONS: Record<ReactionKind, string> = {
  ACKNOWLEDGE: "Got it — I've seen this and understand.",
  QUESTION: "I have a question about this note.",
  ENCOURAGE: "Sending a little support on this one.",
}

export function isReactionKind(value: unknown): value is ReactionKind {
  return (
    typeof value === "string" &&
    (REACTION_KINDS as readonly string[]).includes(value)
  )
}

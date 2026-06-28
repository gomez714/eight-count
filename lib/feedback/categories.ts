/**
 * Client-safe mirror of the `FeedbackCategory` Prisma enum. Mirrors
 * literally (no Prisma import) so this module can be consumed by client
 * components without dragging the Postgres client into the browser bundle.
 * Same pattern as `lib/notes/tags.ts` and `lib/threads/reactions.ts`.
 */

export const FEEDBACK_CATEGORIES = [
  "BUG",
  "IDEA",
  "QUESTION",
  "PRAISE",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "Bug",
  IDEA: "Idea",
  QUESTION: "Question",
  PRAISE: "Praise",
};

/** Rotated into the textarea placeholder so the prompt matches the category. */
export const FEEDBACK_CATEGORY_PROMPTS: Record<FeedbackCategory, string> = {
  BUG: "What broke? Steps to reproduce help a lot.",
  IDEA: "What would make Eight Count better for you?",
  QUESTION: "What were you trying to do?",
  PRAISE: "What's working well? It's good to hear.",
};

/**
 * CSS variable token group for each category's accent tint. Maps to the
 * existing design token families in [app/globals.css] — no new tokens
 * added. Keeps the form visually rhythmic without inventing a feedback-
 * specific palette.
 */
export const FEEDBACK_CATEGORY_TOKENS: Record<
  FeedbackCategory,
  { bg: string; fg: string; border: string }
> = {
  BUG: {
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
    border: "var(--status-progress-border)",
  },
  IDEA: {
    bg: "color-mix(in oklch, var(--primary) 12%, transparent)",
    fg: "var(--primary)",
    border: "color-mix(in oklch, var(--primary) 40%, transparent)",
  },
  QUESTION: {
    bg: "var(--muted)",
    fg: "var(--muted-foreground)",
    border: "var(--border)",
  },
  PRAISE: {
    bg: "var(--note-voice-bg)",
    fg: "var(--note-voice-accent)",
    border: "var(--note-voice-border)",
  },
};

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    typeof value === "string" &&
    (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
  );
}

/** Mirrors `COMMENT_MAX_LENGTH` in [lib/threads/comments.ts]. */
export const FEEDBACK_BODY_MIN_LENGTH = 5;
export const FEEDBACK_BODY_MAX_LENGTH = 2000;

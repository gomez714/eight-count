export const NOTE_TAGS = [
  "TIMING",
  "SPACING",
  "ENERGY",
  "MUSICALITY",
  "FORMATION",
  "TECHNIQUE",
] as const;

export type NoteTag = (typeof NOTE_TAGS)[number];

export const NOTE_TAG_LABELS: Record<NoteTag, string> = {
  TIMING: "Timing",
  SPACING: "Spacing",
  ENERGY: "Energy",
  MUSICALITY: "Musicality",
  FORMATION: "Formation",
  TECHNIQUE: "Technique",
};

export const NOTE_TAG_DESCRIPTIONS: Record<NoteTag, string> = {
  TIMING: "Counts, accents, holds — being on or off the beat.",
  SPACING: "Distances, lines, gaps — relationships in the room.",
  ENERGY: "Effort, attack, commitment — the quality of the doing.",
  MUSICALITY: "Phrasing, dynamics, listening — the voice of the music.",
  FORMATION: "Shapes, transitions, blocking — where bodies belong.",
  TECHNIQUE: "Mechanics, alignment, execution — how the step is built.",
};

export function isNoteTag(value: unknown): value is NoteTag {
  return (
    typeof value === "string" && (NOTE_TAGS as readonly string[]).includes(value)
  );
}

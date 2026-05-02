export { formatNoteTimestamp as formatTimestamp } from "@/lib/notes/format"

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

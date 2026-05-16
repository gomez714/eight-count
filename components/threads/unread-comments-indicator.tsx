import { MessageCircle } from "lucide-react"

type UnreadCommentsIndicatorProps = {
  count: number
}

export function UnreadCommentsIndicator({
  count,
}: Readonly<UnreadCommentsIndicatorProps>) {
  if (count <= 0) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{
        backgroundColor: "color-mix(in oklch, var(--primary) 12%, var(--card))",
        color: "var(--primary)",
        borderColor: "color-mix(in oklch, var(--primary) 35%, transparent)",
      }}
      aria-label={`${count} new ${count === 1 ? "reply" : "replies"}`}
    >
      <MessageCircle aria-hidden className="size-3" />
      {count} new
    </span>
  )
}

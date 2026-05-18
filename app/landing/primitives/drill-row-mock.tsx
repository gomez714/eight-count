import { Check, Repeat } from "lucide-react";
import type { CSSProperties } from "react";

import { TimestampPill } from "./chips";

type DrillItem = {
  ms: number;
  label: string;
  done: boolean;
};

const DEFAULT_ITEMS: DrillItem[] = [
  { ms: 14500, label: "Arms — front line, hold the &-a-5", done: true },
  { ms: 47000, label: "Pirouette — spot back wall", done: true },
  { ms: 72400, label: "Plant on 7, breathe on 8", done: false },
  { ms: 122300, label: "Bridge transition w/ back line", done: false },
  { ms: 152800, label: "Final pose timing", done: false },
];

export function LandingDrillRowMock({
  items = DEFAULT_ITEMS,
  category = "Timing",
  repeatingCount = 3,
  style,
}: Readonly<{
  items?: DrillItem[];
  category?: string;
  repeatingCount?: number;
  style?: CSSProperties;
}>) {
  const doneCount = items.filter((it) => it.done).length;
  return (
    <div
      className="rounded-xl"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        padding: 12,
        boxShadow: "0 18px 40px -22px oklch(0 0 0 / 0.25)",
        ...style,
      }}
    >
      <div className="mb-2.5 flex items-baseline gap-2">
        <span
          className="font-bold tracking-wider text-muted-foreground uppercase"
          style={{ fontSize: 10.5 }}
        >
          Drill · {category}
        </span>
        <span className="text-muted-foreground" style={{ fontSize: 11.5 }}>
          {doneCount} of {items.length}
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full font-bold"
          style={{
            background:
              "color-mix(in oklch, var(--repeating-fg) 12%, transparent)",
            color: "var(--repeating-fg)",
            fontSize: 10,
            padding: "2px 7px",
          }}
        >
          <Repeat className="size-2.5" /> Repeating × {repeatingCount}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {items.map((it) => (
          <li
            key={it.ms}
            className="flex items-center gap-2.5"
            style={{
              padding: "6px 8px",
              background: it.done
                ? "color-mix(in oklch, var(--status-resolved-bg) 60%, transparent)"
                : "var(--surface-sunken)",
              borderRadius: 7,
              fontSize: 12,
              color: it.done
                ? "var(--status-resolved-fg)"
                : "var(--foreground)",
              textDecoration: it.done ? "line-through" : "none",
              textDecorationColor:
                "color-mix(in oklch, var(--status-resolved-fg) 50%, transparent)",
            }}
          >
            <span
              aria-hidden
              className="inline-flex shrink-0 items-center justify-center text-white"
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: `1.5px solid ${
                  it.done ? "var(--status-resolved-fg)" : "var(--border)"
                }`,
                background: it.done
                  ? "var(--status-resolved-fg)"
                  : "transparent",
              }}
            >
              {it.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            <TimestampPill ms={it.ms} accent="primary" size="sm" />
            <span
              className="min-w-0 flex-1"
              style={{ textWrap: "pretty" }}
            >
              {it.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

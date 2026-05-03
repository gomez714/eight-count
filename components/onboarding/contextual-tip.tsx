"use client";

import { X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIP_WIDTH = 320; // px — matches w-80
const GAP = 12; // px between anchor and tip
const VIEWPORT_PADDING = 12; // px — keeps tip from hugging the screen edge
const POINTER_SIZE = 10; // px — visual pointer triangle

type ContextualTipProps = {
  anchorEl: HTMLElement | null;
  title: string;
  body: string;
  step: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onSkip: () => void;
};

type Coords = {
  top: number;
  left: number;
  placement: "top" | "bottom";
  pointerLeft: number;
};

export function ContextualTip({
  anchorEl,
  title,
  body,
  step,
  total,
  isLast,
  onNext,
  onSkip,
}: Readonly<ContextualTipProps>) {
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  // Recompute position whenever the anchor changes, on resize, or on scroll.
  // Scroll listener uses capture so we catch ancestor scroll events too —
  // important since the tip's anchor may be inside a scrollable container.
  useLayoutEffect(() => {
    if (!anchorEl) return;

    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const tipHeight = tipRef.current?.offsetHeight ?? 200;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const spaceBelow = vh - rect.bottom;
      const placeAbove = spaceBelow < tipHeight + GAP + VIEWPORT_PADDING;

      const top = placeAbove
        ? Math.max(VIEWPORT_PADDING, rect.top - GAP - tipHeight)
        : Math.min(
            vh - tipHeight - VIEWPORT_PADDING,
            rect.bottom + GAP
          );

      const desiredLeft = rect.left + rect.width / 2 - TIP_WIDTH / 2;
      const left = Math.max(
        VIEWPORT_PADDING,
        Math.min(vw - TIP_WIDTH - VIEWPORT_PADDING, desiredLeft)
      );

      // Pointer aligns with the center of the anchor, clamped inside the tip.
      const anchorCenterX = rect.left + rect.width / 2;
      const pointerLeft = Math.max(
        16,
        Math.min(TIP_WIDTH - 16, anchorCenterX - left)
      );

      setCoords({
        top,
        left,
        placement: placeAbove ? "top" : "bottom",
        pointerLeft,
      });
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    });
    observer.observe(anchorEl);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [anchorEl]);

  // Render nothing during SSR (no document) or until we have an anchor + coords.
  // The render-time gate replaces the previous `mounted` flag — createPortal
  // is never called server-side because `coords` starts as null.
  if (!anchorEl || !coords || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Soft highlight ring on the anchor so the user's eye lands on it. */}
      <AnchorHighlight el={anchorEl} />

      <div
        ref={tipRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="contextual-tip-title"
        className={cn(
          "fixed z-60 flex flex-col gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
        style={{
          top: coords.top,
          left: coords.left,
          width: TIP_WIDTH,
        }}
      >
        {/* Pointer */}
        <span
          aria-hidden
          className="pointer-events-none absolute size-0"
          style={{
            left: coords.pointerLeft - POINTER_SIZE,
            ...(coords.placement === "bottom"
              ? { top: -POINTER_SIZE }
              : { bottom: -POINTER_SIZE }),
            borderLeft: `${POINTER_SIZE}px solid transparent`,
            borderRight: `${POINTER_SIZE}px solid transparent`,
            ...(coords.placement === "bottom"
              ? { borderBottom: `${POINTER_SIZE}px solid var(--popover)` }
              : { borderTop: `${POINTER_SIZE}px solid var(--popover)` }),
          }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground tabular-nums">
              Tip {step} of {total}
            </span>
            <h3
              id="contextual-tip-title"
              className="text-sm font-semibold tracking-tight"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tour"
            className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">{body}</p>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 outline-none hover:text-foreground hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Skip tour
          </button>
          <Button type="button" size="sm" onClick={onNext}>
            {isLast ? "Got it" : "Next"}
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}

/**
 * Renders a soft glow / outline around the anchor element so the tip feels
 * tied to the thing it's describing. Position-tracking mirrors the tip's.
 */
function AnchorHighlight({ el }: Readonly<{ el: HTMLElement | null }>) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
    };
  }, [el]);

  // Gate on `el` too — a null el means the previous rect is stale; without
  // this we'd briefly highlight the old anchor location.
  if (!el || !rect) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none fixed z-55 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-opacity"
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      }}
    />
  );
}

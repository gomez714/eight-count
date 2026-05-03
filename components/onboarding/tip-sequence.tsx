"use client";

import { useEffect, useState, useTransition } from "react";

import { dismissTipGroupAction } from "@/app/dashboard/onboarding-actions";
import type { TipGroupKey } from "@/lib/onboarding/state";

import { ContextualTip } from "./contextual-tip";

export type TipStep = {
  /** CSS selector for the anchor element (e.g. `[data-onboarding-anchor='timeline']`). */
  anchorSelector: string;
  title: string;
  body: string;
};

type TipSequenceProps = {
  groupKey: TipGroupKey;
  steps: TipStep[];
  /** When true, the sequence renders nothing (user already dismissed this group). */
  initiallyDismissed: boolean;
  /**
   * Optional gating: when false, the sequence stays mounted but waits to start.
   * Useful for pages where anchors only exist after data loads (e.g. video URL
   * needs to resolve before the timeline anchor renders).
   */
  enabled?: boolean;
};

const FIND_RETRY_INTERVAL_MS = 100;
const FIND_MAX_ATTEMPTS = 30; // ~3 seconds total

export function TipSequence({
  groupKey,
  steps,
  initiallyDismissed,
  enabled = true,
}: Readonly<TipSequenceProps>) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [, startTransition] = useTransition();

  // Resolve the anchor element for the current step. Retries briefly because
  // anchors may render after the parent commit (e.g. data-loading branches).
  useEffect(() => {
    // Bail without touching anchorEl — the render-time gate below already
    // returns null when dismissed or disabled, so a stale anchor reference
    // is never visible.
    if (dismissed || !enabled) return;

    const step = steps[stepIndex];
    if (!step) return;

    let attempts = 0;
    let timer: number | null = null;
    let cancelled = false;

    const find = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(step.anchorSelector);
      if (el) {
        setAnchorEl(el);
        return;
      }
      attempts += 1;
      if (attempts < FIND_MAX_ATTEMPTS) {
        timer = window.setTimeout(find, FIND_RETRY_INTERVAL_MS);
      } else {
        // Anchor never appeared — skip to the next step rather than blocking.
        // If this was the last step, dismiss the whole group quietly.
        if (stepIndex < steps.length - 1) {
          setStepIndex(stepIndex + 1);
        } else {
          setDismissed(true);
          startTransition(async () => {
            await dismissTipGroupAction(groupKey);
          });
        }
      }
    };

    find();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [stepIndex, steps, dismissed, enabled, groupKey, startTransition]);

  if (dismissed || !enabled) return null;

  const step = steps[stepIndex];
  if (!step) return null;

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    startTransition(async () => {
      await dismissTipGroupAction(groupKey);
    });
  };

  return (
    <ContextualTip
      anchorEl={anchorEl}
      title={step.title}
      body={step.body}
      step={stepIndex + 1}
      total={steps.length}
      isLast={stepIndex === steps.length - 1}
      onNext={handleNext}
      onSkip={handleDismiss}
    />
  );
}

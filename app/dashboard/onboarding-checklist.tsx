"use client";

import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  checklistVisibleSteps,
  type ChecklistStep,
  type ChecklistStepKey,
} from "@/lib/onboarding/derive-checklist";

import {
  dismissChecklistAction,
  restartOnboardingAction,
  skipChecklistStepAction,
} from "./onboarding-actions";

type OnboardingChecklistProps = {
  steps: ChecklistStep[];
  isDismissed: boolean;
  /** Step keys the user has explicitly skipped — counted as "done" for progress. */
  skippedKeys: ReadonlySet<ChecklistStepKey>;
};

function isEffectivelyDone(
  step: ChecklistStep,
  skippedKeys: ReadonlySet<ChecklistStepKey>
): boolean {
  return step.done || skippedKeys.has(step.key);
}

export function OnboardingChecklist({
  steps,
  isDismissed,
  skippedKeys,
}: Readonly<OnboardingChecklistProps>) {
  const [isPending, startTransition] = useTransition();

  const visible = checklistVisibleSteps(steps);
  const isComplete =
    visible.length > 0 &&
    visible.every((step) => isEffectivelyDone(step, skippedKeys));

  // dismissed + complete = render nothing (per v1: no replay path once finished and hidden).
  if (isDismissed && isComplete) return null;

  // dismissed + incomplete = the slim "show again" line.
  if (isDismissed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Sparkles aria-hidden className="size-3.5" />
          Onboarding hidden
        </span>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await restartOnboardingAction();
              if (result.error) toast.error(result.error);
            })
          }
          disabled={isPending}
          className="font-semibold text-foreground underline decoration-dotted underline-offset-4 outline-none hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring rounded disabled:opacity-50"
        >
          Show again
        </button>
      </div>
    );
  }

  if (visible.length === 0) return null;

  const doneCount = visible.filter((step) =>
    isEffectivelyDone(step, skippedKeys)
  ).length;
  const total = visible.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const handleDismiss = () =>
    startTransition(async () => {
      const result = await dismissChecklistAction();
      if (result.error) toast.error(result.error);
    });

  const handleSkip = (stepKey: ChecklistStepKey) =>
    startTransition(async () => {
      const result = await skipChecklistStepAction(stepKey);
      if (result.error) toast.error(result.error);
    });

  return (
    <section
      aria-labelledby="onboarding-checklist-heading"
      className="flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4 sm:gap-4 sm:p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles aria-hidden className="size-3.5" />
            Get started
          </span>
          <h2
            id="onboarding-checklist-heading"
            className="text-base font-semibold tracking-tight sm:text-lg"
          >
            {isComplete ? "You're all set" : "A few quick steps"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isComplete
              ? "You've gone through the basics. Hide this anytime."
              : "Walk through the basics — each step takes a minute or less."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          aria-label="Hide onboarding checklist"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {/* Progress: count + bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>
            <span className="font-semibold text-foreground">{doneCount}</span>{" "}
            of {total} done
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--status-open-bg)" }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: "var(--status-resolved-fg)",
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="flex flex-col gap-1">
        {visible.map((step) => {
          const skipped = !step.done && skippedKeys.has(step.key);
          return (
            <li key={step.key}>
              <ChecklistRow
                step={step}
                skipped={skipped}
                onSkip={() => handleSkip(step.key)}
                isSkipPending={isPending}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type ChecklistRowProps = {
  step: ChecklistStep;
  skipped: boolean;
  onSkip: () => void;
  isSkipPending: boolean;
};

function ChecklistRow({
  step,
  skipped,
  onSkip,
  isSkipPending,
}: Readonly<ChecklistRowProps>) {
  // Skip button is rendered as a sibling of the Link (not nested) so it
  // doesn't trigger navigation. Only shown when the step is still actionable —
  // hidden once a step is done OR has been skipped.
  const showSkip = !step.done && !skipped;

  return (
    <div className="group flex items-stretch gap-1">
      <Link
        href={step.href}
        className={cn(
          "flex flex-1 items-start gap-3 rounded-md border border-transparent px-2 py-2 outline-none transition-colors",
          "hover:border-border hover:bg-muted/40 focus-visible:border-border focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <StepIndicator done={step.done} skipped={skipped} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "text-sm font-medium",
              step.done && "text-muted-foreground line-through decoration-1",
              skipped && "text-muted-foreground"
            )}
          >
            {step.title}
          </span>
          <span
            className={cn(
              "text-xs text-muted-foreground",
              skipped && "italic"
            )}
          >
            {skipped ? "Skipped — tap to revisit" : step.description}
          </span>
        </div>

        <ChevronRight
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground"
        />
      </Link>

      {showSkip ? (
        <button
          type="button"
          onClick={onSkip}
          disabled={isSkipPending}
          aria-label={`Skip "${step.title}"`}
          className={cn(
            "shrink-0 self-center rounded px-2 py-1 text-[11px] font-medium text-muted-foreground outline-none transition-colors",
            "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50"
          )}
        >
          Skip
        </button>
      ) : null}
    </div>
  );
}

function StepIndicator({
  done,
  skipped,
}: Readonly<{ done: boolean; skipped: boolean }>) {
  if (done) {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: "var(--status-resolved-fg)",
          color: "var(--status-resolved-bg)",
        }}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (skipped) {
    return (
      <span
        aria-hidden
        className="mt-0.5 inline-block size-5 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/40"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-block size-5 shrink-0 rounded-full border-2 border-muted-foreground/30"
    />
  );
}

"use client";

import {
  Bug,
  Check,
  HelpCircle,
  Lightbulb,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitFeedback } from "@/app/feedback/feedback-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_BODY_MAX_LENGTH,
  FEEDBACK_BODY_MIN_LENGTH,
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORY_PROMPTS,
  FEEDBACK_CATEGORY_TOKENS,
  type FeedbackCategory,
} from "@/lib/feedback/categories";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<FeedbackCategory, LucideIcon> = {
  BUG: Bug,
  IDEA: Lightbulb,
  QUESTION: HelpCircle,
  PRAISE: Sparkles,
};

const COUNTER_VISIBLE_AT = 1800;

type FeedbackFormProps = {
  /**
   * Fires after the success card auto-dismisses (or the user taps "Done").
   * The parent uses this to close the Dialog/Drawer.
   */
  onClose: () => void;
};

export function FeedbackForm({ onClose }: Readonly<FeedbackFormProps>) {
  const pathname = usePathname();
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const trimmed = body.trim();
  const tooShort = trimmed.length < FEEDBACK_BODY_MIN_LENGTH;
  const tooLong = body.length > FEEDBACK_BODY_MAX_LENGTH;
  const canSubmit = category !== null && !tooShort && !tooLong && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || category === null) return;

    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("body", trimmed);
      formData.append("pageUrl", pathname);
      if (typeof navigator !== "undefined") {
        formData.append("userAgent", navigator.userAgent);
      }

      const result = await submitFeedback({}, formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSubmitted(true);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter submits — matches comment composer.
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  if (submitted) {
    return <FeedbackSuccess onClose={onClose} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <CategoryPicker
        value={category}
        onChange={(next) => {
          setCategory(next);
          setError(null);
        }}
        disabled={isPending}
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="feedback-body"
          className="text-sm font-medium text-foreground"
        >
          Your message
        </label>
        <Textarea
          id="feedback-body"
          rows={5}
          placeholder={
            category
              ? FEEDBACK_CATEGORY_PROMPTS[category]
              : "Pick a category to get started…"
          }
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          aria-invalid={tooLong}
          className="min-h-[120px]"
        />
        <div className="flex min-h-[20px] items-center justify-between text-xs text-muted-foreground">
          <span>
            {/* Cmd/Ctrl+Enter hint mirrors the comment composer. */}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              {typeof navigator !== "undefined" &&
              navigator.platform.toLowerCase().includes("mac")
                ? "⌘"
                : "Ctrl"}
            </kbd>{" "}
            +{" "}
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to send
          </span>
          {body.length >= COUNTER_VISIBLE_AT ? (
            <span
              className={cn(
                "tabular-nums",
                tooLong && "text-destructive"
              )}
            >
              {body.length} / {FEEDBACK_BODY_MAX_LENGTH}
            </span>
          ) : null}
        </div>
      </div>

      <ContextPreview pathname={pathname} />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending ? "Sending…" : "Send feedback"}
        </Button>
      </div>
    </form>
  );
}

type CategoryPickerProps = {
  value: FeedbackCategory | null;
  onChange: (next: FeedbackCategory) => void;
  disabled?: boolean;
};

function CategoryPicker({ value, onChange, disabled }: Readonly<CategoryPickerProps>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">Category</span>
      <div
        className="grid grid-cols-4 gap-2"
        role="radiogroup"
        aria-label="Feedback category"
      >
        {FEEDBACK_CATEGORIES.map((kind) => {
          const Icon = CATEGORY_ICONS[kind];
          const tokens = FEEDBACK_CATEGORY_TOKENS[kind];
          const isActive = value === kind;
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(kind)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg border-2 px-2 py-3 text-xs font-medium transition-colors",
                "hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isActive
                  ? "shadow-sm"
                  : "border-border bg-background text-muted-foreground"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: tokens.bg,
                      color: tokens.fg,
                      borderColor: tokens.border,
                    }
                  : undefined
              }
            >
              <Icon className="size-4" aria-hidden />
              <span>{FEEDBACK_CATEGORY_LABELS[kind]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type ContextPreviewProps = {
  pathname: string;
};

function ContextPreview({ pathname }: Readonly<ContextPreviewProps>) {
  return (
    <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
      We&apos;ll include the page you&apos;re on (
      <span className="not-italic font-mono text-foreground/70">
        {pathname}
      </span>
      ) and your account email so we can reply. Nothing else.
    </p>
  );
}

type FeedbackSuccessProps = {
  onClose: () => void;
};

function FeedbackSuccess({ onClose }: Readonly<FeedbackSuccessProps>) {
  // Auto-dismiss after 4s. The "Done" button is the primary close action;
  // the timer is a courtesy for users who don't tap anything (matches
  // sonner's auto-dismiss feel without using a toast — the in-form card
  // is warmer and survives keyboard-focus on mobile).
  useEffect(() => {
    const timer = setTimeout(() => {
      // Quietly toast in case the user has navigated away — sonner
      // surfaces it from anywhere in the app.
      toast.success("Thanks for the feedback!");
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-foreground">
          Got it — Luis will see this within a day.
        </p>
        <p className="text-sm text-muted-foreground">
          A reply (if needed) will come from{" "}
          <span className="font-mono text-foreground/70">
            lgomez00714@gmail.com
          </span>
          . Watch your inbox.
        </p>
      </div>
      <Button onClick={onClose} className="mt-2">
        Done
      </Button>
    </div>
  );
}

import { Bug, HelpCircle, Lightbulb, Sparkles, type LucideIcon } from "lucide-react";

import {
  FEEDBACK_CATEGORY_LABELS,
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

type FeedbackCategoryChipProps = {
  category: FeedbackCategory;
  className?: string;
};

export function FeedbackCategoryChip({
  category,
  className,
}: Readonly<FeedbackCategoryChipProps>) {
  const Icon = CATEGORY_ICONS[category];
  const tokens = FEEDBACK_CATEGORY_TOKENS[category];
  return (
    <span
      data-category={category}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        backgroundColor: tokens.bg,
        color: tokens.fg,
        borderColor: tokens.border,
      }}
    >
      <Icon className="size-3" aria-hidden />
      {FEEDBACK_CATEGORY_LABELS[category]}
    </span>
  );
}

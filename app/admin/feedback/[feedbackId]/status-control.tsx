"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import type { FeedbackStatus } from "@/generated/prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateFeedbackStatus } from "../admin-feedback-actions";
import { FEEDBACK_STATUS_LABELS } from "../feedback-status-chip";

const STATUSES: FeedbackStatus[] = [
  "NEW",
  "TRIAGED",
  "IN_PROGRESS",
  "SHIPPED",
  "WONT_DO",
  "DUPLICATE",
];

type StatusControlProps = {
  feedbackId: string;
  current: FeedbackStatus;
};

export function StatusControl({
  feedbackId,
  current,
}: Readonly<StatusControlProps>) {
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (next === current) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("feedbackId", feedbackId);
      formData.append("status", next);

      const result = await updateFeedbackStatus({}, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Marked as ${FEEDBACK_STATUS_LABELS[next as FeedbackStatus]}.`
      );
    });
  }

  return (
    <Select
      value={current}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger
        aria-label="Change feedback status"
        className="h-8 w-[160px] text-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {FEEDBACK_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

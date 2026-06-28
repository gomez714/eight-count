"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { respondToFeedback } from "../admin-feedback-actions";

type ResponseFormProps = {
  feedbackId: string;
  authorDisplay: string;
  authorEmail: string;
  /**
   * Existing response, if the operator has already replied once. When
   * set, the form renders in "amend" mode — the textarea is pre-filled
   * with the prior response so it's editable as a starting point, and
   * the button changes to "Send updated reply" to make clear the user
   * will get a second email.
   */
  previousResponse: string | null;
};

export function ResponseForm({
  feedbackId,
  authorDisplay,
  authorEmail,
  previousResponse,
}: Readonly<ResponseFormProps>) {
  const [value, setValue] = useState(previousResponse ?? "");
  const [isPending, startTransition] = useTransition();

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isPending;
  const isAmending = previousResponse !== null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("feedbackId", feedbackId);
      formData.append("response", trimmed);

      const result = await respondToFeedback({}, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reply sent to ${authorEmail}.`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="response-body"
          className="text-sm font-medium text-foreground"
        >
          {isAmending ? "Update your reply" : `Reply to ${authorDisplay}`}
        </label>
        <p className="text-xs text-muted-foreground">
          Sent as a plain email from your support address. {authorDisplay} can
          reply back and it will route to your inbox.
        </p>
      </div>
      <Textarea
        id="response-body"
        rows={5}
        placeholder="Hey — thanks for flagging this…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={isPending}
        className="min-h-[120px]"
      />
      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!canSend}>
          {isPending
            ? "Sending…"
            : isAmending
              ? "Send updated reply"
              : "Send reply"}
        </Button>
      </div>
    </form>
  );
}

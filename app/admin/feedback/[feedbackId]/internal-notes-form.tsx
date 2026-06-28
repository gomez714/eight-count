"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { saveInternalNotes } from "../admin-feedback-actions";

type InternalNotesFormProps = {
  feedbackId: string;
  initialValue: string | null;
};

export function InternalNotesForm({
  feedbackId,
  initialValue,
}: Readonly<InternalNotesFormProps>) {
  const [value, setValue] = useState(initialValue ?? "");
  const [isPending, startTransition] = useTransition();

  const initial = initialValue ?? "";
  const isDirty = value !== initial;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || isPending) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("feedbackId", feedbackId);
      formData.append("internalNotes", value);

      const result = await saveInternalNotes({}, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Internal notes saved.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        rows={3}
        placeholder="Scratchpad — only you see this. Useful for triage decisions, related rows, follow-ups…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={isPending}
        className="min-h-[80px] text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        {isDirty ? (
          <span className="text-xs text-muted-foreground">Unsaved</span>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!isDirty || isPending}
        >
          {isPending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </form>
  );
}

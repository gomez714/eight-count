"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { CreateDiscussionResponse } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ProjectDiscussionComposerProps = {
  projectId: string;
};

/**
 * Project-level discussion composer — text only. Posts with `rehearsalId:
 * null` so the new discussion lives at the project level (spans every
 * rehearsal). Voice + anchored variants are workspace-only in v1 (voice
 * requires a rehearsal anchor; anchored = rehearsal-scoped by definition).
 *
 * Auth: any team member of the project's team (including dancers — the
 * route allows it).
 */
export function ProjectDiscussionComposer({
  projectId,
}: Readonly<ProjectDiscussionComposerProps>) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  const submit = () => {
    if (!canSend || isPending) return;
    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch(`/api/projects/${projectId}/discussions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteType: "TEXT",
            bodyText: trimmed,
          }),
        });
        const data = (await res.json()) as CreateDiscussionResponse;
        if (!data.ok) throw new Error(data.error.message);
        setText("");
        toast.success("Discussion posted");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to post discussion."
        );
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Start a project-wide discussion — what should we be exploring?"
          disabled={isPending}
          rows={2}
          className="min-h-[64px] flex-1 resize-none"
        />
        <Button
          type="button"
          onClick={submit}
          disabled={!canSend || isPending}
          size="sm"
          className="shrink-0"
        >
          <Send className="size-3.5" />
          {isPending ? "Posting…" : "Post"}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

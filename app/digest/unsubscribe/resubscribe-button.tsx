"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { resubscribeFromTokenAction } from "./actions";

/**
 * Inline "Re-subscribe" affordance shown after an auto-unsubscribe.
 * Holds the same token as the unsubscribe link so the server can
 * re-verify without trusting a userId pulled from the DOM.
 */
export function ResubscribeButton({
  token,
}: Readonly<{ token: string }>) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const handleClick = () => {
    startTransition(async () => {
      const result = await resubscribeFromTokenAction(token);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Re-subscribed to the daily digest.");
      setDone(true);
    });
  };

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        You&apos;re back on the daily digest.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="rounded-full"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Re-subscribing…" : "Changed your mind? Re-subscribe"}
    </Button>
  );
}

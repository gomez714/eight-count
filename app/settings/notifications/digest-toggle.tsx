"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";

import { setDigestEnabledAction } from "./actions";

export function DigestToggle({
  initialEnabled,
}: Readonly<{ initialEnabled: boolean }>) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const handleChange = (next: boolean) => {
    // Optimistic flip — the switch should feel immediate even if the
    // server action takes a moment. Roll back on error.
    setEnabled(next);
    startTransition(async () => {
      const result = await setDigestEnabledAction(next);
      if (result.error) {
        setEnabled(!next);
        toast.error(result.error);
        return;
      }
      toast.success(
        next ? "Daily digest turned on." : "Daily digest turned off."
      );
    });
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="digest-switch"
          className="text-sm font-medium text-foreground"
        >
          Daily email digest
        </label>
        <p className="text-sm text-muted-foreground">
          We email you once a day when you have new notes, replies, or
          stalled items waiting. We never send empty digests.
        </p>
      </div>
      <Switch
        id="digest-switch"
        checked={enabled}
        onCheckedChange={handleChange}
        disabled={pending}
        aria-label="Daily email digest"
      />
    </div>
  );
}

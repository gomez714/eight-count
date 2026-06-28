"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState } from "react";

import { FeedbackForm } from "./feedback-form";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

const TITLE = "Send feedback";
const DESCRIPTION =
  "Bug, idea, question, or kind word — anything that would help us make Eight Count better for you.";

export function FeedbackLauncherClient() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // useMediaQuery returns null during SSR/pre-hydration. Render the
  // trigger optimistically (it doesn't depend on viewport), but only
  // mount one shell (Dialog OR Drawer) once we know which to use —
  // mirrors the composer's single-mount rule.
  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Send feedback"
      title="Send feedback"
      data-onboarding-anchor="feedback-launcher"
      className={cn(
        "inline-flex size-9 cursor-pointer items-center justify-center rounded-md",
        "text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      )}
    >
      <MessageCircleQuestion className="size-5" aria-hidden />
    </button>
  );

  // Pre-hydration: just the trigger, no shell. The first click after
  // hydration opens the correct surface for the viewport.
  if (isDesktop === null) {
    return trigger;
  }

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{TITLE}</DialogTitle>
              <DialogDescription>{DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <FeedbackForm onClose={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{TITLE}</DrawerTitle>
            <DrawerDescription>{DESCRIPTION}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <FeedbackForm onClose={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

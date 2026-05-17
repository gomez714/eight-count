"use client";

import { Card } from "@/components/ui/card";

import {
  DiscussionComposer,
  type DiscussionComposerProps,
} from "./discussion-composer";

export type AddDiscussionCardProps = DiscussionComposerProps;

/**
 * Desktop shell for the discussion composer. Mirrors AddNoteCard —
 * just wraps the composer body in a Card. Mobile uses the shared
 * MobileComposerSheet directly with `<DiscussionComposer />` slotted
 * into the body.
 */
export function AddDiscussionCard(props: AddDiscussionCardProps) {
  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-md">
      <DiscussionComposer {...props} />
    </Card>
  );
}

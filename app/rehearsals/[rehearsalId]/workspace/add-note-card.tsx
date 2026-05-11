"use client";

import { Card } from "@/components/ui/card";

import { ComposerBody, type ComposerBodyProps } from "./composer-body";

export type AddNoteCardProps = ComposerBodyProps;

export function AddNoteCard(props: AddNoteCardProps) {
  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-md">
      <ComposerBody {...props} />
    </Card>
  );
}

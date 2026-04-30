"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import { AudiencePicker } from "./audience-picker";
import type { AssignableMember, AvailableGroup } from "./types";
import { formatTimestamp } from "./utils";

type AddNoteCardProps = {
  selectedTimestampMs: number;
  noteText: string;
  onNoteTextChange: (value: string) => void;
  selectedAssigneeUserIds: string[];
  assignableMembers: AssignableMember[];
  availableGroups: AvailableGroup[];
  selectedGroupIds: string[];
  onToggleAssignee: (userId: string) => void;
  onToggleGroup: (groupId: string) => void;
  isFullCast: boolean;
  onToggleFullCast: (next: boolean) => void;
  noteError: string | null;
  isPending: boolean;
  disabled: boolean;
  onCapture: () => void;
  onSubmit: () => void;
};

function describeRecipientCount(count: number): string {
  const noun = count === 1 ? "person" : "people";
  return `Will notify ${count} ${noun}.`;
}

export function AddNoteCard({
  selectedTimestampMs,
  noteText,
  onNoteTextChange,
  selectedAssigneeUserIds,
  assignableMembers,
  availableGroups,
  selectedGroupIds,
  onToggleAssignee,
  onToggleGroup,
  isFullCast,
  onToggleFullCast,
  noteError,
  isPending,
  disabled,
  onCapture,
  onSubmit,
}: AddNoteCardProps) {
  const fullCastCount = assignableMembers.length;

  // Live "will notify N people" preview based on the current selection.
  const recipientCount = useMemo(() => {
    if (isFullCast) return fullCastCount;

    const groupLookup = new Map(
      availableGroups.map((group) => [group.id, group])
    );

    const recipients = new Set<string>();
    for (const groupId of selectedGroupIds) {
      const group = groupLookup.get(groupId);
      if (!group) continue;
      for (const userId of group.memberUserIds) recipients.add(userId);
    }
    for (const userId of selectedAssigneeUserIds) {
      recipients.add(userId);
    }
    return recipients.size;
  }, [
    isFullCast,
    fullCastCount,
    availableGroups,
    selectedGroupIds,
    selectedAssigneeUserIds,
  ]);

  const hasAnySelection =
    isFullCast ||
    selectedGroupIds.length > 0 ||
    selectedAssigneeUserIds.length > 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Add note</CardTitle>
        <CardDescription>
          Capture the current timestamp, then leave feedback tied to that
          moment.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-6">
        <FieldGroup className="flex flex-1 flex-col gap-4">
          <Field>
            <FieldLabel>Selected timestamp</FieldLabel>
            <FieldContent>
              <div className="text-sm font-medium">
                {formatTimestamp(selectedTimestampMs)}
              </div>
              <FieldDescription>
                Capturing a timestamp pauses the video automatically.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field className="flex flex-1 flex-col">
            <FieldLabel htmlFor="noteText">Note</FieldLabel>
            <FieldContent className="flex flex-1 flex-col">
              <Textarea
                id="noteText"
                value={noteText}
                onChange={(event) => onNoteTextChange(event.target.value)}
                placeholder="Timing is late entering this phrase"
                disabled={isPending}
                className="flex-1 resize-none md:min-h-[150px]"
              />
              <FieldDescription>
                Leave a clear correction or reminder for this exact moment.
              </FieldDescription>
              <FieldError
                errors={noteError ? [{ message: noteError }] : []}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Audience</FieldLabel>
            <FieldContent>
              <AudiencePicker
                assignableMembers={assignableMembers}
                availableGroups={availableGroups}
                selectedGroupIds={selectedGroupIds}
                selectedAssigneeUserIds={selectedAssigneeUserIds}
                isFullCast={isFullCast}
                disabled={isPending}
                onToggleFullCast={onToggleFullCast}
                onToggleGroup={onToggleGroup}
                onToggleMember={onToggleAssignee}
              />
              <FieldDescription>
                {hasAnySelection
                  ? describeRecipientCount(recipientCount)
                  : "Pick \"Full cast\", a group, or specific members. Leave empty for an unassigned general note."}
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>

        <div className="mt-auto flex flex-wrap gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCapture}
            disabled={disabled}
          >
            Capture current timestamp
          </Button>

          <Button type="button" onClick={onSubmit} disabled={disabled}>
            {isPending ? "Saving..." : "Add note"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

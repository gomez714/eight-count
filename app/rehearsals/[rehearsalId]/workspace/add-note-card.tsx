"use client";

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
import type { AssignableMember } from "./types";

import { formatTimestamp } from "./utils";

type AddNoteCardProps = {
  selectedTimestampMs: number;
  noteText: string;
  onNoteTextChange: (value: string) => void;
  selectedAssigneeUserIds: string[];
  assignableMembers: AssignableMember[];
  onToggleAssignee: (userId: string) => void;
  noteError: string | null;
  isPending: boolean;
  disabled: boolean;
  onCapture: () => void;
  onSubmit: () => void;
};

export function AddNoteCard({
  selectedTimestampMs,
  noteText,
  onNoteTextChange,
  selectedAssigneeUserIds,
  assignableMembers,
  onToggleAssignee,
  noteError,
  isPending,
  disabled,
  onCapture,
  onSubmit,
}: AddNoteCardProps) {
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
            <FieldLabel>Assign to team members</FieldLabel>
            <FieldContent>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {assignableMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No assignable members available.
                  </p>
                ) : (
                  assignableMembers.map((member) => {
                    const checked = selectedAssigneeUserIds.includes(member.id);

                    return (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleAssignee(member.id)}
                          disabled={isPending}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {member.name || member.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {member.email} • {member.role}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <FieldDescription>
                Leave this empty for an unassigned general note.
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
"use client";

import { useMemo, useState } from "react";

import type { NoteTargetInput } from "@/lib/api/contracts";
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
import { cn } from "@/lib/utils";

import { AudiencePicker } from "./audience-picker";
import type { AssignableMember, AvailableGroup } from "./types";
import { formatTimestamp } from "./utils";
import { VoiceNoteRecorder } from "./voice-note-recorder";

type AddNoteCardProps = {
  rehearsalId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
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
  onVoiceNoteSaved: () => void;
};

function describeRecipientCount(count: number): string {
  const noun = count === 1 ? "person" : "people";
  return `Will notify ${count} ${noun}.`;
}

type Mode = "TEXT" | "VOICE";

export function AddNoteCard({
  rehearsalId,
  videoRef,
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
  onVoiceNoteSaved,
}: AddNoteCardProps) {
  const [mode, setMode] = useState<Mode>("TEXT");

  const fullCastCount = assignableMembers.length;

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

  const buildTargets = (): NoteTargetInput[] => {
    if (isFullCast) return [{ kind: "EVERYONE" }];
    return [
      ...selectedGroupIds.map((projectGroupId) => ({
        kind: "GROUP" as const,
        projectGroupId,
      })),
      ...selectedAssigneeUserIds.map((userId) => ({
        kind: "USER" as const,
        userId,
      })),
    ];
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Add note</CardTitle>
        <CardDescription>
          Capture the current timestamp, then leave feedback tied to that
          moment.
        </CardDescription>
        <div
          className="mt-3 inline-flex w-fit gap-1 rounded-md border bg-muted/40 p-1"
          role="tablist"
          aria-label="Note type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "TEXT"}
            onClick={() => setMode("TEXT")}
            className={cn(
              "rounded-sm px-3 py-1 text-sm transition-colors",
              mode === "TEXT"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "VOICE"}
            onClick={() => setMode("VOICE")}
            className={cn(
              "rounded-sm px-3 py-1 text-sm transition-colors",
              mode === "VOICE"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Voice
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-6">
        <FieldGroup className="flex flex-1 flex-col gap-4">
          {mode === "TEXT" ? (
            <>
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
            </>
          ) : (
            <Field>
              <FieldLabel>Recording</FieldLabel>
              <FieldContent>
                <VoiceNoteRecorder
                  rehearsalId={rehearsalId}
                  videoRef={videoRef}
                  buildTargets={buildTargets}
                  onSaved={onVoiceNoteSaved}
                  disabled={disabled}
                />
              </FieldContent>
            </Field>
          )}

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

        {mode === "TEXT" ? (
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
        ) : null}
      </CardContent>
    </Card>
  );
}

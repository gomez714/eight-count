"use client";

import { useMemo, useState } from "react";

import { AudiencePicker } from "@/app/rehearsals/[rehearsalId]/workspace/audience-picker";
import { TagPicker } from "@/app/rehearsals/[rehearsalId]/workspace/tag-picker";
import type {
  AssignableMember,
  AvailableGroup,
} from "@/app/rehearsals/[rehearsalId]/workspace/types";
import { VoiceNotePlayer } from "@/app/rehearsals/[rehearsalId]/workspace/voice-note-player";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { NoteStatus } from "@/lib/notes/statuses";
import type { NoteTag } from "@/lib/notes/tags";

export type EditNoteFormValues = {
  bodyText: string | null;
  startTimestampMs: number;
  endTimestampMs: number | null;
  tag: NoteTag | null;
  isFullCast: boolean;
  selectedGroupIds: string[];
  selectedAssigneeUserIds: string[];
};

export type EditableNoteAssignment = {
  userId: string;
  status: NoteStatus;
  displayName: string;
};

export type EditableNoteAudio = {
  id: string;
  mimeType: string;
  durationMs: number | null;
};

export type EditableNote = {
  id: string;
  noteType: "TEXT" | "VOICE";
  bodyText: string | null;
  startTimestampMs: number;
  endTimestampMs: number | null;
  tag: NoteTag | null;
  audioAsset: EditableNoteAudio | null;
  targets: Array<{
    kind: "EVERYONE" | "GROUP" | "USER";
    user: { id: string } | null;
    group: { id: string } | null;
  }>;
  /**
   * Existing per-recipient assignments, used to warn the author when an
   * audience change would drop dancers who have already engaged with
   * the note (status != OPEN).
   */
  assignments: EditableNoteAssignment[];
};

type EditNoteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: EditableNote | null;
  assignableMembers: AssignableMember[];
  availableGroups: AvailableGroup[];
  /**
   * If provided, a "Use current playhead" button is rendered. Returns
   * the current video playback position in milliseconds.
   */
  onUseCurrentPlayhead?: () => number;
  isPending: boolean;
  errorMessage: string | null;
  onSubmit: (values: EditNoteFormValues) => void | Promise<void>;
};

function describeRecipientCount(count: number): string {
  const noun = count === 1 ? "person" : "people";
  return `Will notify ${count} ${noun}.`;
}

function parseMmSsToMs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return seconds * 1000;
  }

  const match = /^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) return null;
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  const millis = match[3] ? Number.parseInt(match[3].padEnd(3, "0"), 10) : 0;
  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    !Number.isFinite(millis)
  ) {
    return null;
  }
  return minutes * 60_000 + seconds * 1000 + millis;
}

function formatMsToMmSs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function deriveInitialAudience(note: EditableNote): {
  isFullCast: boolean;
  selectedGroupIds: string[];
  selectedAssigneeUserIds: string[];
} {
  const isFullCast = note.targets.some(
    (target) => target.kind === "EVERYONE"
  );
  if (isFullCast) {
    return {
      isFullCast: true,
      selectedGroupIds: [],
      selectedAssigneeUserIds: [],
    };
  }
  const selectedGroupIds: string[] = [];
  const selectedAssigneeUserIds: string[] = [];
  for (const target of note.targets) {
    if (target.kind === "GROUP" && target.group) {
      selectedGroupIds.push(target.group.id);
    } else if (target.kind === "USER" && target.user) {
      selectedAssigneeUserIds.push(target.user.id);
    }
  }
  return { isFullCast: false, selectedGroupIds, selectedAssigneeUserIds };
}

type EditNoteFormProps = Omit<EditNoteSheetProps, "open" | "onOpenChange"> & {
  note: EditableNote;
  onCancel: () => void;
};

// Form lives in a child component keyed on note.id by the parent. That
// makes the initial-state seeding happen via useState initializers when
// the form mounts — no useEffect cascade needed when switching notes.
function EditNoteForm({
  note,
  assignableMembers,
  availableGroups,
  onUseCurrentPlayhead,
  isPending,
  errorMessage,
  onSubmit,
  onCancel,
}: EditNoteFormProps) {
  const initialAudience = useMemo(() => deriveInitialAudience(note), [note]);
  const isVoice = note.noteType === "VOICE";

  const [bodyText, setBodyText] = useState(note.bodyText ?? "");
  const [startTimestampInput, setStartTimestampInput] = useState(() =>
    formatMsToMmSs(note.startTimestampMs)
  );
  const [endTimestampInput, setEndTimestampInput] = useState(() =>
    note.endTimestampMs !== null ? formatMsToMmSs(note.endTimestampMs) : ""
  );
  const [startTimestampError, setStartTimestampError] = useState<string | null>(
    null
  );
  const [endTimestampError, setEndTimestampError] = useState<string | null>(
    null
  );
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [isFullCast, setIsFullCast] = useState(initialAudience.isFullCast);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    initialAudience.selectedGroupIds
  );
  const [selectedAssigneeUserIds, setSelectedAssigneeUserIds] = useState<
    string[]
  >(initialAudience.selectedAssigneeUserIds);
  const [tag, setTag] = useState<NoteTag | null>(note.tag);

  const newResolvedUserIds = useMemo(() => {
    const recipients = new Set<string>();
    if (isFullCast) {
      for (const member of assignableMembers) recipients.add(member.id);
      return recipients;
    }
    const groupLookup = new Map(
      availableGroups.map((group) => [group.id, group])
    );
    for (const groupId of selectedGroupIds) {
      const group = groupLookup.get(groupId);
      if (!group) continue;
      for (const userId of group.memberUserIds) recipients.add(userId);
    }
    for (const userId of selectedAssigneeUserIds) {
      recipients.add(userId);
    }
    return recipients;
  }, [
    isFullCast,
    assignableMembers,
    availableGroups,
    selectedGroupIds,
    selectedAssigneeUserIds,
  ]);

  const recipientCount = newResolvedUserIds.size;

  // Existing assignments whose recipients have already engaged with the
  // note (status != OPEN) and would be dropped by saving the current
  // audience selection. OPEN assignments are intentionally excluded:
  // re-scoping before anyone has acted matches the create-flow mental
  // model and shouldn't require friction.
  const assignmentsAtRisk = useMemo(() => {
    return note.assignments.filter(
      (assignment) =>
        assignment.status !== "OPEN" &&
        !newResolvedUserIds.has(assignment.userId)
    );
  }, [note.assignments, newResolvedUserIds]);

  const hasAnySelection =
    isFullCast ||
    selectedGroupIds.length > 0 ||
    selectedAssigneeUserIds.length > 0;

  const handleToggleFullCast = (next: boolean) => {
    setIsFullCast(next);
    if (next) {
      setSelectedGroupIds([]);
      setSelectedAssigneeUserIds([]);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
    if (isFullCast) setIsFullCast(false);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedAssigneeUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
    if (isFullCast) setIsFullCast(false);
  };

  const [confirmDropOpen, setConfirmDropOpen] = useState(false);

  const handleUseStartPlayhead = () => {
    if (!onUseCurrentPlayhead) return;
    const ms = onUseCurrentPlayhead();
    setStartTimestampInput(formatMsToMmSs(ms));
    setStartTimestampError(null);
  };

  const handleUseEndPlayhead = () => {
    if (!onUseCurrentPlayhead) return;
    const ms = onUseCurrentPlayhead();
    setEndTimestampInput(formatMsToMmSs(ms));
    setEndTimestampError(null);
  };

  type ValidatedValues = {
    bodyText: string | null;
    startMs: number;
    endMs: number | null;
  };

  const validate = (): ValidatedValues | null => {
    setBodyError(null);
    setStartTimestampError(null);
    setEndTimestampError(null);

    const startMs = parseMmSsToMs(startTimestampInput);
    if (startMs === null) {
      setStartTimestampError("Use M:SS format, e.g. 1:23.");
      return null;
    }

    if (isVoice) {
      const endMs = parseMmSsToMs(endTimestampInput);
      if (endMs === null) {
        setEndTimestampError("Use M:SS format, e.g. 1:23.");
        return null;
      }
      if (endMs < startMs) {
        setEndTimestampError("End must be at or after the start.");
        return null;
      }
      return { bodyText: null, startMs, endMs };
    }

    const trimmed = bodyText.trim();
    if (!trimmed) {
      setBodyError("Please enter a note.");
      return null;
    }
    return { bodyText: trimmed, startMs, endMs: null };
  };

  const submit = async (validated: ValidatedValues) => {
    await onSubmit({
      bodyText: validated.bodyText,
      startTimestampMs: validated.startMs,
      endTimestampMs: validated.endMs,
      tag,
      isFullCast,
      selectedGroupIds,
      selectedAssigneeUserIds,
    });
  };

  const handleSaveClick = async () => {
    const validated = validate();
    if (!validated) return;

    // Gate save behind a confirm dialog only when this edit will drop
    // dancers who have already engaged. No friction otherwise.
    if (assignmentsAtRisk.length > 0) {
      setConfirmDropOpen(true);
      return;
    }

    await submit(validated);
  };

  const handleConfirmDrop = async () => {
    const validated = validate();
    if (!validated) {
      setConfirmDropOpen(false);
      return;
    }
    setConfirmDropOpen(false);
    await submit(validated);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4">
        <FieldGroup className="flex flex-col gap-4 py-2">
          <Field>
            <FieldLabel htmlFor="editStartTimestamp">
              {isVoice ? "Start timestamp" : "Timestamp"}
            </FieldLabel>
            <FieldContent>
              <div className="flex items-center gap-2">
                <Input
                  id="editStartTimestamp"
                  value={startTimestampInput}
                  onChange={(event) => {
                    setStartTimestampInput(event.target.value);
                    setStartTimestampError(null);
                  }}
                  placeholder="0:00"
                  disabled={isPending}
                  className="w-28"
                />
                {onUseCurrentPlayhead ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseStartPlayhead}
                    disabled={isPending}
                  >
                    Use current playhead
                  </Button>
                ) : null}
              </div>
              <FieldDescription>
                Format: minutes:seconds (e.g. 1:23).
              </FieldDescription>
              <FieldError
                errors={
                  startTimestampError
                    ? [{ message: startTimestampError }]
                    : []
                }
              />
            </FieldContent>
          </Field>

          {isVoice ? (
            <Field>
              <FieldLabel htmlFor="editEndTimestamp">End timestamp</FieldLabel>
              <FieldContent>
                <div className="flex items-center gap-2">
                  <Input
                    id="editEndTimestamp"
                    value={endTimestampInput}
                    onChange={(event) => {
                      setEndTimestampInput(event.target.value);
                      setEndTimestampError(null);
                    }}
                    placeholder="0:00"
                    disabled={isPending}
                    className="w-28"
                  />
                  {onUseCurrentPlayhead ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUseEndPlayhead}
                      disabled={isPending}
                    >
                      Use current playhead
                    </Button>
                  ) : null}
                </div>
                <FieldError
                  errors={
                    endTimestampError ? [{ message: endTimestampError }] : []
                  }
                />
              </FieldContent>
            </Field>
          ) : null}

          {isVoice && note.audioAsset ? (
            <Field>
              <FieldLabel>Recording</FieldLabel>
              <FieldContent>
                <VoiceNotePlayer
                  audioAssetId={note.audioAsset.id}
                  durationMs={note.audioAsset.durationMs}
                />
                <FieldDescription>
                  To replace the audio, delete this note and record a new one.
                </FieldDescription>
              </FieldContent>
            </Field>
          ) : null}

          {!isVoice ? (
            <Field>
              <FieldLabel htmlFor="editBodyText">Note</FieldLabel>
              <FieldContent>
                <Textarea
                  id="editBodyText"
                  value={bodyText}
                  onChange={(event) => setBodyText(event.target.value)}
                  disabled={isPending}
                  className="min-h-[120px] resize-none"
                />
                <FieldError
                  errors={bodyError ? [{ message: bodyError }] : []}
                />
              </FieldContent>
            </Field>
          ) : null}

          <Field>
            <FieldLabel>Tag</FieldLabel>
            <FieldContent>
              <TagPicker value={tag} onChange={setTag} disabled={isPending} size="md" />
              <FieldDescription>
                Helps surface repeated corrections — e.g. multiple TIMING notes for the same dancer.
              </FieldDescription>
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
                onToggleFullCast={handleToggleFullCast}
                onToggleGroup={handleToggleGroup}
                onToggleMember={handleToggleMember}
              />
              <FieldDescription>
                {hasAnySelection
                  ? describeRecipientCount(recipientCount)
                  : "Leave empty to make this an unassigned general note."}
              </FieldDescription>
              {assignmentsAtRisk.length > 0 ? (
                <AssignmentsAtRiskBanner
                  assignments={assignmentsAtRisk}
                />
              ) : null}
            </FieldContent>
          </Field>

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </FieldGroup>
      </div>

      <SheetFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSaveClick} disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </SheetFooter>

      <AlertDialog open={confirmDropOpen} onOpenChange={setConfirmDropOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop dancers with progress?</AlertDialogTitle>
            <AlertDialogDescription>
              Saving will remove{" "}
              {assignmentsAtRisk.length === 1
                ? "1 dancer"
                : `${assignmentsAtRisk.length} dancers`}{" "}
              who have already responded to this note. Their statuses will
              be lost: {formatAtRiskNames(assignmentsAtRisk)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDrop();
              }}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Saving..." : "Save anyway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function formatAtRiskNames(assignments: EditableNoteAssignment[]): string {
  const names = assignments.map((a) => a.displayName);
  if (names.length <= 3) return names.join(", ");
  const head = names.slice(0, 3).join(", ");
  const rest = names.length - 3;
  return `${head} and ${rest} other${rest === 1 ? "" : "s"}`;
}

type AssignmentsAtRiskBannerProps = {
  assignments: EditableNoteAssignment[];
};

function AssignmentsAtRiskBanner({
  assignments,
}: AssignmentsAtRiskBannerProps) {
  const count = assignments.length;
  const subject = count === 1 ? "1 dancer who has" : `${count} dancers who have`;
  return (
    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-medium">Heads up: this will drop progress.</p>
      <p className="mt-0.5">
        Saving removes {subject} already responded:{" "}
        {formatAtRiskNames(assignments)}.
      </p>
    </div>
  );
}

export function EditNoteSheet({
  open,
  onOpenChange,
  note,
  assignableMembers,
  availableGroups,
  onUseCurrentPlayhead,
  isPending,
  errorMessage,
  onSubmit,
}: EditNoteSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Edit note</SheetTitle>
          <SheetDescription>
            Update the text, timestamp, or audience. Existing dancers&apos;
            statuses are preserved when the audience changes.
          </SheetDescription>
        </SheetHeader>

        {note ? (
          <EditNoteForm
            key={note.id}
            note={note}
            assignableMembers={assignableMembers}
            availableGroups={availableGroups}
            onUseCurrentPlayhead={onUseCurrentPlayhead}
            isPending={isPending}
            errorMessage={errorMessage}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

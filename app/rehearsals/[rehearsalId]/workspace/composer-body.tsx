"use client";

import { ChevronDown, Clock, FileText, Mic, Send, Users } from "lucide-react";
import { useMemo } from "react";

import type { NoteTargetInput } from "@/lib/api/contracts";
import type { NoteTag } from "@/lib/notes/tags";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { AudiencePicker } from "./audience-picker";
import { TagPicker } from "./tag-picker";
import type { AssignableMember, AvailableGroup } from "./types";
import { formatTimestamp } from "./utils";
import { VoiceNoteRecorder } from "./voice-note-recorder";

export type ComposerMode = "TEXT" | "VOICE";

export type AudienceSummary = {
  label: string;
  icon: React.ReactNode;
  recipientCount: number;
};

export function buildAudienceSummary(
  isFullCast: boolean,
  fullCastCount: number,
  selectedGroupIds: string[],
  selectedAssigneeUserIds: string[],
  availableGroups: AvailableGroup[],
  assignableMembers: AssignableMember[],
  recipientCount: number
): AudienceSummary {
  if (isFullCast) {
    return {
      label: `Full cast · ${fullCastCount}`,
      icon: <Users className="size-3" />,
      recipientCount: fullCastCount,
    };
  }

  const totalSelections =
    selectedGroupIds.length + selectedAssigneeUserIds.length;

  if (totalSelections === 0) {
    return {
      label: "Pick audience",
      icon: <Users className="size-3" />,
      recipientCount: 0,
    };
  }

  if (totalSelections === 1) {
    if (selectedGroupIds.length === 1) {
      const group = availableGroups.find((g) => g.id === selectedGroupIds[0]);
      if (group) {
        return {
          label: `${group.name} · ${group.memberUserIds.length}`,
          icon: <Users className="size-3" />,
          recipientCount,
        };
      }
    }
    if (selectedAssigneeUserIds.length === 1) {
      const member = assignableMembers.find(
        (m) => m.id === selectedAssigneeUserIds[0]
      );
      if (member) {
        return {
          label: member.name || member.email,
          icon: <Users className="size-3" />,
          recipientCount,
        };
      }
    }
  }

  return {
    label: `${totalSelections} selected · ${recipientCount}`,
    icon: <Users className="size-3" />,
    recipientCount,
  };
}

export function computeRecipientCount(
  isFullCast: boolean,
  fullCastCount: number,
  availableGroups: AvailableGroup[],
  selectedGroupIds: string[],
  selectedAssigneeUserIds: string[]
): number {
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
}

export type ComposerBodyProps = {
  rehearsalId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  selectedTimestampMs: number;
  noteText: string;
  onNoteTextChange: (value: string) => void;
  mode: ComposerMode;
  onModeChange: (next: ComposerMode) => void;
  audienceOpen: boolean;
  onAudienceOpenChange: (open: boolean) => void;
  selectedAssigneeUserIds: string[];
  assignableMembers: AssignableMember[];
  availableGroups: AvailableGroup[];
  selectedGroupIds: string[];
  onToggleAssignee: (userId: string) => void;
  onToggleGroup: (groupId: string) => void;
  isFullCast: boolean;
  onToggleFullCast: (next: boolean) => void;
  selectedTag: NoteTag | null;
  onSelectedTagChange: (next: NoteTag | null) => void;
  getSelectedTag: () => NoteTag | null;
  noteError: string | null;
  isPending: boolean;
  disabled: boolean;
  onCapture: () => void;
  onSubmit: () => void;
  onVoiceNoteSaved: () => void;
  // Forwarded to VoiceNoteRecorder. Mobile sheet uses this to lock dismissal
  // during countdown/recording. Desktop AddNoteCard doesn't pass it (no
  // sheet to lock), so the callback chain stays inert there.
  onRecordingStateChange?: (isRecording: boolean) => void;
};

export function ComposerBody({
  rehearsalId,
  videoRef,
  selectedTimestampMs,
  noteText,
  onNoteTextChange,
  mode,
  onModeChange,
  audienceOpen,
  onAudienceOpenChange,
  selectedAssigneeUserIds,
  assignableMembers,
  availableGroups,
  selectedGroupIds,
  onToggleAssignee,
  onToggleGroup,
  isFullCast,
  onToggleFullCast,
  selectedTag,
  onSelectedTagChange,
  getSelectedTag,
  noteError,
  isPending,
  disabled,
  onCapture,
  onSubmit,
  onVoiceNoteSaved,
  onRecordingStateChange,
}: ComposerBodyProps) {
  const fullCastCount = assignableMembers.length;

  const recipientCount = useMemo(
    () =>
      computeRecipientCount(
        isFullCast,
        fullCastCount,
        availableGroups,
        selectedGroupIds,
        selectedAssigneeUserIds
      ),
    [
      isFullCast,
      fullCastCount,
      availableGroups,
      selectedGroupIds,
      selectedAssigneeUserIds,
    ]
  );

  const audienceSummary = buildAudienceSummary(
    isFullCast,
    fullCastCount,
    selectedGroupIds,
    selectedAssigneeUserIds,
    availableGroups,
    assignableMembers,
    recipientCount
  );

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
    <>
      {/* Sub-bar: tabs · audience popover · locked timestamp */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <div
          className="inline-flex gap-1 rounded-md border bg-card p-0.5"
          role="tablist"
          aria-label="Note type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "TEXT"}
            onClick={() => onModeChange("TEXT")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors",
              mode === "TEXT"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="size-3" />
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "VOICE"}
            onClick={() => onModeChange("VOICE")}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors",
              mode === "VOICE"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Mic className="size-3" />
            Voice
          </button>
        </div>

        <span aria-hidden className="h-4 w-px bg-border" />

        <span className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
          To
        </span>

        <Popover open={audienceOpen} onOpenChange={onAudienceOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isPending}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              {audienceSummary.icon}
              <span>{audienceSummary.label}</span>
              <ChevronDown className="size-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="start">
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
          </PopoverContent>
        </Popover>

        <span aria-hidden className="h-4 w-px bg-border" />

        <TagPicker
          value={selectedTag}
          onChange={onSelectedTagChange}
          disabled={isPending}
        />

        <button
          type="button"
          onClick={onCapture}
          disabled={disabled}
          title="Tap to update to the current video time"
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 font-mono text-xs text-muted-foreground hover:border-border hover:bg-card disabled:opacity-50"
        >
          <Clock className="size-3" />
          <span>
            Note appears at{" "}
            <span className="font-semibold text-foreground">
              {formatTimestamp(selectedTimestampMs)}
            </span>
          </span>
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        {mode === "TEXT" ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <Textarea
                id="noteText"
                value={noteText}
                onChange={(event) => onNoteTextChange(event.target.value)}
                placeholder={`Note at ${formatTimestamp(selectedTimestampMs)}…`}
                disabled={isPending}
                rows={2}
                className="min-h-[64px] flex-1 resize-none"
              />
              <Button
                type="button"
                onClick={onSubmit}
                disabled={disabled}
                size="sm"
                className="shrink-0"
              >
                <Send className="size-3.5" />
                {isPending ? "Posting…" : "Post"}
              </Button>
            </div>
            {noteError ? (
              <p className="text-xs text-destructive" role="alert">
                {noteError}
              </p>
            ) : null}
          </div>
        ) : (
          <VoiceNoteRecorder
            rehearsalId={rehearsalId}
            videoRef={videoRef}
            buildTargets={buildTargets}
            getTag={getSelectedTag}
            onSaved={onVoiceNoteSaved}
            disabled={disabled}
            onRecordingStateChange={onRecordingStateChange}
          />
        )}
      </div>
    </>
  );
}

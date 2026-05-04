"use client";

import { ChevronDown, Clock, FileText, Mic, Send, Users } from "lucide-react";
import { useMemo, useState } from "react";

import type { NoteTargetInput } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

type Mode = "TEXT" | "VOICE";

type AudienceSummary = {
  label: string;
  icon: React.ReactNode;
  recipientCount: number;
};

function buildAudienceSummary(
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
  const [audienceOpen, setAudienceOpen] = useState(false);

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
    <Card className="gap-0 overflow-hidden p-0 shadow-md">
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
            onClick={() => setMode("TEXT")}
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
            onClick={() => setMode("VOICE")}
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

        <Popover open={audienceOpen} onOpenChange={setAudienceOpen}>
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
            onSaved={onVoiceNoteSaved}
            disabled={disabled}
          />
        )}
      </div>
    </Card>
  );
}

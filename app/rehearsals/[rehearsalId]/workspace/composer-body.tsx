"use client";

import { ChevronDown, Clock, FileText, Mic, Send, Users } from "lucide-react";
import { useMemo } from "react";

import type { NoteTargetInput } from "@/lib/api/contracts";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
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
  /**
   * Mobile only: when true, the text-mode textarea uses a larger
   * min-height (180px vs 64px default) so the sheet's writing snap has
   * a comfortable typing surface. Driven by the workspace based on
   * `composerSnap === COMPOSER_WRITING_SNAP`.
   */
  writingMode?: boolean;
  /**
   * Mobile only: fires on the textarea's focus/blur so the workspace
   * can promote the sheet to the writing snap (and hide the video +
   * timeline) once the user actually starts typing.
   */
  onTextareaFocusChange?: (focused: boolean) => void;
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
  writingMode = false,
  onTextareaFocusChange,
}: ComposerBodyProps) {
  // Treat null (SSR / pre-hydration) as not-desktop. The audience popover
  // would render off-screen on a mobile viewport, while the inline panel
  // is benign during the brief unresolved window since `audienceOpen`
  // is always false until the user taps the trigger post-hydration.
  const isDesktop = useMediaQuery("(min-width: 1024px)") === true;
  const useInlineAudience = !isDesktop;

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

  // Body content — extracted as a variable (vs. nested ternaries inline)
  // to keep the JSX flat and the function's cognitive complexity in check.
  let body: React.ReactNode;
  if (useInlineAudience && audienceOpen) {
    // Mobile inline audience panel: replaces textarea/recorder while
    // picking recipients. Sub-bar above stays so the user keeps
    // timestamp + mode + tag context. "Done" closes the panel and
    // returns to whichever mode they were in.
    body = (
      <InlineAudiencePanel
        assignableMembers={assignableMembers}
        availableGroups={availableGroups}
        selectedGroupIds={selectedGroupIds}
        selectedAssigneeUserIds={selectedAssigneeUserIds}
        isFullCast={isFullCast}
        disabled={isPending}
        onToggleFullCast={onToggleFullCast}
        onToggleGroup={onToggleGroup}
        onToggleMember={onToggleAssignee}
        onDone={() => onAudienceOpenChange(false)}
      />
    );
  } else if (mode === "TEXT") {
    body = (
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <Textarea
            id="noteText"
            value={noteText}
            onChange={(event) => onNoteTextChange(event.target.value)}
            onFocus={() => onTextareaFocusChange?.(true)}
            onBlur={() => onTextareaFocusChange?.(false)}
            placeholder={`Note at ${formatTimestamp(selectedTimestampMs)}…`}
            disabled={isPending}
            rows={writingMode ? 6 : 2}
            className={cn(
              "flex-1 resize-none",
              writingMode ? "min-h-[180px]" : "min-h-[64px]"
            )}
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
    );
  } else {
    body = (
      <VoiceNoteRecorder
        rehearsalId={rehearsalId}
        videoRef={videoRef}
        buildTargets={buildTargets}
        getTag={getSelectedTag}
        onSaved={onVoiceNoteSaved}
        disabled={disabled}
        onRecordingStateChange={onRecordingStateChange}
      />
    );
  }

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

        {useInlineAudience ? (
          // Mobile: plain toggle button. The picker UI renders inline in
          // the body area below (replacing textarea/recorder) when open,
          // avoiding the popover-over-sheet-over-keyboard stacking
          // problem on small viewports.
          <button
            type="button"
            disabled={isPending}
            onClick={() => onAudienceOpenChange(!audienceOpen)}
            aria-expanded={audienceOpen}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {audienceSummary.icon}
            <span>{audienceSummary.label}</span>
            <ChevronDown
              className={cn(
                "size-3 opacity-60 transition-transform",
                audienceOpen && "rotate-180",
              )}
            />
          </button>
        ) : (
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
        )}

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
      <div className="p-3">{body}</div>
    </>
  );
}

type InlineAudiencePanelProps = {
  assignableMembers: AssignableMember[];
  availableGroups: AvailableGroup[];
  selectedGroupIds: string[];
  selectedAssigneeUserIds: string[];
  isFullCast: boolean;
  disabled: boolean;
  onToggleFullCast: (next: boolean) => void;
  onToggleGroup: (groupId: string) => void;
  onToggleMember: (userId: string) => void;
  onDone: () => void;
};

/**
 * Mobile-only audience picker rendered inline in the composer sheet body.
 * Replaces the popover when the sheet is open on small viewports — the
 * keyboard-aware writing-mode snap gives the picker enough room to
 * breathe, and there's no popover-over-sheet-over-keyboard stacking to
 * collision-detect around. The "Done" button is the explicit close
 * affordance; selection state mutates immediately via the same toggle
 * callbacks the popover used.
 */
function InlineAudiencePanel({
  assignableMembers,
  availableGroups,
  selectedGroupIds,
  selectedAssigneeUserIds,
  isFullCast,
  disabled,
  onToggleFullCast,
  onToggleGroup,
  onToggleMember,
  onDone,
}: Readonly<InlineAudiencePanelProps>) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-sm font-semibold">Pick audience</span>
        <Button type="button" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
      <AudiencePicker
        assignableMembers={assignableMembers}
        availableGroups={availableGroups}
        selectedGroupIds={selectedGroupIds}
        selectedAssigneeUserIds={selectedAssigneeUserIds}
        isFullCast={isFullCast}
        disabled={disabled}
        onToggleFullCast={onToggleFullCast}
        onToggleGroup={onToggleGroup}
        onToggleMember={onToggleMember}
      />
    </div>
  );
}

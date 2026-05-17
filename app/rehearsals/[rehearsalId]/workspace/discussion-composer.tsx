"use client";

import { Clock, FileText, Mic, Pin, PinOff, Send } from "lucide-react";

import type { CreateDiscussionResponse } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { ComposerMode } from "./composer-body";
import { formatTimestamp } from "./utils";
import { VoiceNoteRecorder } from "./voice-note-recorder";

export type DiscussionComposerProps = {
  rehearsalId: string;
  projectId: string;
  /** The rehearsal's video asset id, when ready. Required for voice + anchored text. */
  videoAssetId: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;

  // Tab-specific state lifted from the workspace so drafts survive
  // tab toggles and (on mobile) sheet collapse.
  text: string;
  onTextChange: (next: string) => void;
  isAnchored: boolean;
  onIsAnchoredChange: (next: boolean) => void;
  selectedTimestampMs: number;
  onCaptureTimestamp: () => void;

  // Shared with the note composer (one snap, one mode at a time).
  mode: ComposerMode;
  onModeChange: (next: ComposerMode) => void;

  // Submit + status
  isPending: boolean;
  disabled: boolean;
  onTextSubmit: () => void;
  onVoiceSaved: () => void;

  /** Mobile only: forwarded to the recorder so the sheet can lock during a take. */
  onRecordingStateChange?: (isRecording: boolean) => void;
  /** Mobile only: bumps the textarea to a comfortable typing height. */
  writingMode?: boolean;
  onTextareaFocusChange?: (focused: boolean) => void;
  /**
   * Optional error from the parent's text-submit transition. Voice errors
   * surface inside `<VoiceNoteRecorder />` itself.
   */
  errorMessage?: string | null;
};

/**
 * Discussion composer — lighter than `ComposerBody`. No audience picker
 * (discussions are team-wide), no tag picker (deferred to v1.5), and an
 * "anchor to current frame" toggle replaces the always-on timestamp pill.
 *
 * Voice always requires the anchor (per the API validation: voice
 * discussions require rehearsalId, videoAssetId, and both timestamps).
 * Switching to voice mode auto-enables the anchor; the toggle is
 * disabled while voice is selected.
 */
export function DiscussionComposer(props: Readonly<DiscussionComposerProps>) {
  const { mode, isAnchored, videoAssetId } = props;
  const canAnchor = videoAssetId !== null;
  const voiceAvailable = canAnchor;
  const effectiveAnchored = mode === "VOICE" ? true : isAnchored && canAnchor;

  return (
    <>
      <SubBar
        {...props}
        canAnchor={canAnchor}
        voiceAvailable={voiceAvailable}
        effectiveAnchored={effectiveAnchored}
      />
      <div className="p-3">
        <ComposerBodySlot
          {...props}
          voiceAvailable={voiceAvailable}
          effectiveAnchored={effectiveAnchored}
        />
      </div>
    </>
  );
}

// ── Sub-bar ─────────────────────────────────────────────────────────────

type SubBarProps = DiscussionComposerProps & {
  canAnchor: boolean;
  voiceAvailable: boolean;
  effectiveAnchored: boolean;
};

function SubBar({
  mode,
  onModeChange,
  isAnchored,
  onIsAnchoredChange,
  selectedTimestampMs,
  onCaptureTimestamp,
  isPending,
  disabled,
  canAnchor,
  voiceAvailable,
  effectiveAnchored,
}: Readonly<SubBarProps>) {
  const handleAnchorToggle = () => {
    if (mode === "VOICE") return; // voice always anchored
    onIsAnchoredChange(!isAnchored);
  };
  const anchorDisabled = !canAnchor || mode === "VOICE" || isPending;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
      <ModeTabs
        mode={mode}
        onModeChange={onModeChange}
        voiceAvailable={voiceAvailable}
      />

      <span aria-hidden className="h-4 w-px bg-border" />

      <AnchorToggle
        effectiveAnchored={effectiveAnchored}
        disabled={anchorDisabled}
        title={anchorTitle(mode, effectiveAnchored)}
        onClick={handleAnchorToggle}
        forceDisabledLook={!canAnchor || mode === "VOICE"}
      />

      {effectiveAnchored ? (
        <button
          type="button"
          onClick={onCaptureTimestamp}
          disabled={disabled}
          title="Tap to update to the current video time"
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 font-mono text-xs text-muted-foreground hover:border-border hover:bg-card disabled:opacity-50"
        >
          <Clock className="size-3" />
          <span>
            At{" "}
            <span className="font-semibold text-foreground">
              {formatTimestamp(selectedTimestampMs)}
            </span>
          </span>
        </button>
      ) : null}
    </div>
  );
}

function anchorTitle(mode: ComposerMode, effectiveAnchored: boolean): string {
  if (mode === "VOICE") {
    return "Voice discussions are always anchored to the current frame.";
  }
  if (effectiveAnchored) {
    return "Anchored to the current frame. Tap to scope to the whole rehearsal instead.";
  }
  return "Scoped to this rehearsal. Tap to anchor to the current frame.";
}

// ── Mode tabs ───────────────────────────────────────────────────────────

type ModeTabsProps = {
  mode: ComposerMode;
  onModeChange: (next: ComposerMode) => void;
  voiceAvailable: boolean;
};

function ModeTabs({
  mode,
  onModeChange,
  voiceAvailable,
}: Readonly<ModeTabsProps>) {
  return (
    <div
      className="inline-flex gap-1 rounded-md border bg-card p-0.5"
      role="tablist"
      aria-label="Discussion type"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "TEXT"}
        onClick={() => onModeChange("TEXT")}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors",
          mode === "TEXT"
            ? "text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
        style={
          mode === "TEXT"
            ? { backgroundColor: "var(--discussion-accent)" }
            : undefined
        }
      >
        <FileText className="size-3" />
        Text
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "VOICE"}
        onClick={() => onModeChange("VOICE")}
        disabled={!voiceAvailable}
        title={
          voiceAvailable
            ? undefined
            : "Voice discussions require a ready rehearsal video."
        }
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors",
          mode === "VOICE"
            ? "text-background"
            : "text-muted-foreground hover:text-foreground",
          !voiceAvailable && "cursor-not-allowed opacity-50"
        )}
        style={
          mode === "VOICE"
            ? { backgroundColor: "var(--note-voice-accent)" }
            : undefined
        }
      >
        <Mic className="size-3" />
        Voice
      </button>
    </div>
  );
}

// ── Anchor toggle ───────────────────────────────────────────────────────

type AnchorToggleProps = {
  effectiveAnchored: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
  forceDisabledLook: boolean;
};

function AnchorToggle({
  effectiveAnchored,
  disabled,
  title,
  onClick,
  forceDisabledLook,
}: Readonly<AnchorToggleProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={effectiveAnchored}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        effectiveAnchored
          ? "text-background"
          : "bg-card text-muted-foreground hover:text-foreground",
        forceDisabledLook && "cursor-not-allowed opacity-60"
      )}
      style={
        effectiveAnchored
          ? { backgroundColor: "var(--discussion-accent)" }
          : undefined
      }
    >
      {effectiveAnchored ? (
        <Pin className="size-3" />
      ) : (
        <PinOff className="size-3" />
      )}
      {effectiveAnchored ? "Anchored" : "Rehearsal-wide"}
    </button>
  );
}

// ── Body slot ───────────────────────────────────────────────────────────

type ComposerBodySlotProps = DiscussionComposerProps & {
  voiceAvailable: boolean;
  effectiveAnchored: boolean;
};

function ComposerBodySlot(props: Readonly<ComposerBodySlotProps>) {
  if (props.mode === "VOICE") {
    return <VoiceBody {...props} />;
  }
  return <TextBody {...props} />;
}

function VoiceBody({
  rehearsalId,
  projectId,
  videoAssetId,
  videoRef,
  disabled,
  voiceAvailable,
  onRecordingStateChange,
  onVoiceSaved,
}: Readonly<ComposerBodySlotProps>) {
  if (!voiceAvailable || !videoAssetId) {
    return (
      <p className="text-sm text-muted-foreground">
        Voice discussions need a ready rehearsal video to anchor to. Upload
        or wait for the video to finish processing, then try again.
      </p>
    );
  }
  return (
    <VoiceNoteRecorder
      rehearsalId={rehearsalId}
      videoRef={videoRef}
      uploadPurpose="discussion"
      saveButtonLabel="Save voice discussion"
      disabled={disabled}
      onRecordingStateChange={onRecordingStateChange}
      onAudioReady={async ({
        audioAssetId,
        startTimestampMs,
        endTimestampMs,
      }) => {
        const resp = await fetch(`/api/projects/${projectId}/discussions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteType: "VOICE",
            rehearsalId,
            videoAssetId,
            audioAssetId,
            startTimestampMs,
            endTimestampMs,
          }),
        });
        const data = (await resp.json()) as CreateDiscussionResponse;
        if (!data.ok) throw new Error(data.error.message);
        onVoiceSaved();
      }}
    />
  );
}

function TextBody({
  text,
  onTextChange,
  selectedTimestampMs,
  effectiveAnchored,
  isPending,
  disabled,
  onTextSubmit,
  onTextareaFocusChange,
  writingMode,
  errorMessage,
}: Readonly<ComposerBodySlotProps>) {
  const placeholder = effectiveAnchored
    ? `Open a thread about ${formatTimestamp(selectedTimestampMs)}…`
    : "Open a thread about the rehearsal…";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onFocus={() => onTextareaFocusChange?.(true)}
          onBlur={() => onTextareaFocusChange?.(false)}
          placeholder={placeholder}
          disabled={isPending}
          rows={writingMode ? 6 : 2}
          className={cn(
            "flex-1 resize-none",
            writingMode ? "min-h-[180px]" : "min-h-[64px]"
          )}
        />
        <Button
          type="button"
          onClick={onTextSubmit}
          disabled={disabled || isPending || text.trim().length === 0}
          size="sm"
          className="shrink-0"
        >
          <Send className="size-3.5" />
          {isPending ? "Posting…" : "Post"}
        </Button>
      </div>
      {errorMessage ? (
        <p className="text-xs text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

import {
  buildAudienceSummary,
  ComposerBody,
  type ComposerBodyProps,
  type ComposerMode,
  computeRecipientCount,
} from "./composer-body";
import { ComposerPeekRow } from "./composer-peek-row";

// Exported so the workspace can use them when controlling snap state and
// deriving `composerExpanded` for the sticky-video logic.
export const COMPOSER_PEEK_SNAP = "80px";
// Single expanded snap shared by text and voice modes. Set to 55vh so the
// textarea sits in the upper portion of the sheet, leaving it visible above
// a typical on-screen keyboard without relying on Vaul's `repositionInputs`
// auto-lift (which had keyboard-dismiss restoration bugs on real devices).
// We accept a few pixels of overlap on the smallest phones rather than the
// auto-lift's white-screen / stuck-near-keyboard glitches. Long textareas
// grow inside the body via `field-sizing-content` and scroll through
// `overflow-y-auto` rather than expanding the sheet.
export const COMPOSER_EXPANDED_SNAP = 0.55;

export type ComposerSnap = number | string;

export type MobileComposerSheetProps = ComposerBodyProps & {
  // Controlled snap state — owned by the workspace so the sticky-video logic
  // can read whether the composer is expanded without a callback round-trip.
  snap: ComposerSnap;
  onSnapChange: (next: ComposerSnap) => void;
  // True while the voice recorder is in countdown or recording (not while
  // saving/uploading). Locks dismissal so accidental swipes can't kill an
  // in-flight take.
  isRecording: boolean;
};

type Snap = number | string | null;

export function MobileComposerSheet(props: MobileComposerSheetProps) {
  const {
    snap,
    onSnapChange,
    isRecording,
    mode,
    onModeChange,
    selectedTimestampMs,
    isFullCast,
    selectedGroupIds,
    selectedAssigneeUserIds,
    availableGroups,
    assignableMembers,
    onCapture,
    onAudienceOpenChange,
    noteText,
    isPending,
    disabled,
    onVoiceNoteSaved,
  } = props;

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

  // Auto-collapse to peek after a successful text submit. Detects the
  // pending: true → false transition combined with empty text (errors keep
  // the text in place, success clears it in the parent). Uses the React
  // "deriving state from props" pattern instead of a setState-in-effect.
  // See https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevPending, setPrevPending] = useState(isPending);
  if (prevPending !== isPending) {
    setPrevPending(isPending);
    const justFinished = prevPending && !isPending;
    if (
      justFinished &&
      noteText.trim().length === 0 &&
      snap !== COMPOSER_PEEK_SNAP
    ) {
      onSnapChange(COMPOSER_PEEK_SNAP);
    }
  }

  // Wrap the parent's onModeChange to suppress mode toggles while recording
  // (toggling would unmount the recorder mid-take). Mode no longer affects
  // snap — both modes share COMPOSER_EXPANDED_SNAP, so toggling is purely a
  // content swap.
  const handleModeChange = useCallback(
    (next: ComposerMode) => {
      if (isRecording) return;
      onModeChange(next);
    },
    [isRecording, onModeChange]
  );

  const handleSnapChange = (next: Snap) => {
    // Vaul can call this with null when the user drags below the smallest
    // snap; we treat that as "collapse to peek" instead of dismissing.
    if (next === null) {
      onSnapChange(COMPOSER_PEEK_SNAP);
      return;
    }
    if (isRecording && next !== COMPOSER_EXPANDED_SNAP) {
      onSnapChange(COMPOSER_EXPANDED_SNAP);
      return;
    }
    onSnapChange(next);
  };

  const handleExpand = () => {
    onSnapChange(COMPOSER_EXPANDED_SNAP);
  };

  // Tapping the audience chip in peek expands AND opens the picker. Both
  // setState calls batch — by the time ComposerBody mounts (because
  // !isPeek), audienceOpen is already true, so the popover renders open.
  const handleTapAudience = () => {
    onAudienceOpenChange(true);
    onSnapChange(COMPOSER_EXPANDED_SNAP);
  };

  const handleVoiceNoteSaved = () => {
    onVoiceNoteSaved();
    onSnapChange(COMPOSER_PEEK_SNAP);
  };

  const isPeek = snap === COMPOSER_PEEK_SNAP;

  return (
    <DrawerPrimitive.Root
      open
      modal={false}
      dismissible={false}
      // Disable Vaul's auto-lift for on-screen keyboards. On real devices it
      // had two glitches: (1) the lift sometimes oversized the drawer to fill
      // the viewport (whiting out the page), and (2) on keyboard dismiss the
      // drawer didn't restore to its snap position — it stayed translated up
      // where the keyboard had been. With auto-lift off, the keyboard
      // overlays whatever is below it and the drawer stays put. The 55vh
      // snap puts the textarea in the upper portion of the sheet so it
      // remains mostly visible above the keyboard.
      repositionInputs={false}
      snapPoints={[COMPOSER_PEEK_SNAP, COMPOSER_EXPANDED_SNAP]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          data-onboarding-anchor="workspace-composer"
          aria-label="Add a note"
          // h-full is what Vaul's snap math expects — the drawer is 100% of
          // its parent (the portal target / viewport), and Vaul translates
          // the element so only the snap-defined amount is visible at the
          // bottom. Constraining the height (e.g. `h-[55vh]` or
          // `max-h-[55vh]`) breaks Vaul's positioning and the drawer ends
          // up below the viewport. Over-drag past EXPANDED_SNAP during the
          // gesture is bounded by Vaul's release-snap (returns to nearest
          // snap on release) and the `dismissible={false}` floor at peek.
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex h-full flex-col rounded-t-xl border-t bg-popover text-popover-foreground shadow-lg",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-2 mb-1 h-1.5 w-[40px] shrink-0 rounded-full bg-muted"
          />

          <DrawerPrimitive.Title className="sr-only">
            Add a note
          </DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            Compose a text or voice note anchored to the current video time.
          </DrawerPrimitive.Description>

          {isPeek ? (
            <ComposerPeekRow
              mode={mode}
              onModeChange={handleModeChange}
              selectedTimestampMs={selectedTimestampMs}
              audienceSummary={audienceSummary}
              onCaptureTimestamp={onCapture}
              onTapAudience={handleTapAudience}
              onExpand={handleExpand}
              disabled={disabled}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <ComposerBody
                {...props}
                onModeChange={handleModeChange}
                onVoiceNoteSaved={handleVoiceNoteSaved}
              />
            </div>
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

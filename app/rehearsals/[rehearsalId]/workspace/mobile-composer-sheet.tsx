"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

import {
  buildAudienceSummary,
  ComposerBody,
  type ComposerBodyProps,
  type ComposerMode,
  computeRecipientCount,
} from "./composer-body"
import { ComposerPeekRow } from "./composer-peek-row"

// Exported so the workspace can use them when controlling snap state and
// deriving `composerExpanded` for the sticky-video logic.
export const COMPOSER_PEEK_SNAP = "80px"
// Default expanded snap shared by text and voice modes. Sized to the
// composer's worst-case content height rather than as a viewport fraction:
// drag handle 18 + sub-bar 84 (wrapped on narrow phones) + body padding 24
// + voice preview body 150 ≈ 276 → 280 with a hair of breathing room.
// Text mode (~206px) leaves a small empty strip at the bottom; that's
// preferable to clipping voice preview's player + Save button. Long
// textareas grow inside the body via `field-sizing-content` and scroll
// through `overflow-y-auto` rather than expanding the sheet.
export const COMPOSER_EXPANDED_SNAP = "220px"
// Writing-mode snap — auto-activated when the user focuses the textarea
// in text mode. Tall enough for a comfortable textarea (~180px), the
// sub-bar, and the Post button. Sized to its content (not a viewport
// fraction) so it doesn't leave a dead zone between the composer and
// the keyboard. When this snap is active, the workspace hides the video
// and timeline on mobile so the user has room to write. See "Mobile
// composer sheet → Writing mode" in CLAUDE.md.
export const COMPOSER_WRITING_SNAP = "340px"

export type ComposerSnap = number | string

export type MobileComposerSheetProps = ComposerBodyProps & {
  // Controlled snap state — owned by the workspace so the sticky-video logic
  // can read whether the composer is expanded without a callback round-trip.
  snap: ComposerSnap
  onSnapChange: (next: ComposerSnap) => void
  // True while the voice recorder is in countdown or recording (not while
  // saving/uploading). Locks dismissal so accidental swipes can't kill an
  // in-flight take.
  isRecording: boolean
}

type Snap = number | string | null

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
  } = props

  const fullCastCount = assignableMembers.length
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
  )
  const audienceSummary = buildAudienceSummary(
    isFullCast,
    fullCastCount,
    selectedGroupIds,
    selectedAssigneeUserIds,
    availableGroups,
    assignableMembers,
    recipientCount
  )

  // Auto-collapse to peek after a successful text submit. Detects the
  // pending: true → false transition combined with empty text (errors keep
  // the text in place, success clears it in the parent). Uses the React
  // "deriving state from props" pattern instead of a setState-in-effect.
  // See https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevPending, setPrevPending] = useState(isPending)
  if (prevPending !== isPending) {
    setPrevPending(isPending)
    const justFinished = prevPending && !isPending
    if (
      justFinished &&
      noteText.trim().length === 0 &&
      snap !== COMPOSER_PEEK_SNAP
    ) {
      onSnapChange(COMPOSER_PEEK_SNAP)
    }
  }

  // Wrap the parent's onModeChange to suppress mode toggles while recording
  // (toggling would unmount the recorder mid-take). Mode no longer affects
  // snap — both modes share COMPOSER_EXPANDED_SNAP, so toggling is purely a
  // content swap.
  const handleModeChange = useCallback(
    (next: ComposerMode) => {
      if (isRecording) return
      onModeChange(next)
    },
    [isRecording, onModeChange]
  )

  const handleSnapChange = (next: Snap) => {
    // Vaul can call this with null when the user drags below the smallest
    // snap; we treat that as "collapse to peek" instead of dismissing.
    if (next === null) {
      onSnapChange(COMPOSER_PEEK_SNAP)
      return
    }
    if (isRecording && next !== COMPOSER_EXPANDED_SNAP) {
      onSnapChange(COMPOSER_EXPANDED_SNAP)
      return
    }
    onSnapChange(next)
  }

  const handleExpand = () => {
    onSnapChange(COMPOSER_EXPANDED_SNAP)
  }

  // Tapping the audience chip in peek opens the picker. The workspace's
  // `onAudienceOpenChange` wrapper handles snap promotion (writing snap)
  // so the inline panel has room — see `handleAudienceOpenChange` in
  // rehearsal-workspace.tsx. We just fire the open call.
  const handleTapAudience = () => {
    onAudienceOpenChange(true)
  }

  const handleVoiceNoteSaved = () => {
    onVoiceNoteSaved()
    onSnapChange(COMPOSER_PEEK_SNAP)
  }

  const isPeek = snap === COMPOSER_PEEK_SNAP

  // Vaul's `modal={false}` prop only affects Vaul's own pointer-down
  // and focus-outside handlers — it does NOT propagate to the underlying
  // Radix `DialogPrimitive.Root`, which always renders in modal mode
  // (engaging Radix's FocusScope). FocusScope traps focus inside the
  // drawer by listening for `focusin` events on the document and
  // refocusing the last drawer element when focus moves outside. That
  // makes interactive elements on the page (e.g. comment composer
  // textareas) impossible to click into while the sheet is open.
  //
  // Escape it with a capture-phase `focusin` listener that runs before
  // Radix's bubble-phase listener and stops propagation when focus is
  // moving to an element outside the drawer. `stopImmediatePropagation`
  // in capture also stops bubble-phase handlers, so Radix's refocus
  // never fires.
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const target = e.target as Element | null
      if (!target) return
      // Vaul tags its content element with `data-vaul-drawer`. Anything
      // outside that subtree is fair game for focus.
      const drawerContent = document.querySelector("[data-vaul-drawer]")
      if (drawerContent && !drawerContent.contains(target)) {
        e.stopImmediatePropagation()
      }
    }
    document.addEventListener("focusin", handler, true)
    return () => document.removeEventListener("focusin", handler, true)
  }, [])

  return (
    <DrawerPrimitive.Root
      open
      modal={false}
      dismissible={false}
      repositionInputs={false}
      snapPoints={[
        COMPOSER_PEEK_SNAP,
        COMPOSER_EXPANDED_SNAP,
        COMPOSER_WRITING_SNAP,
      ]}
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
          // bottom. Constraining the height (e.g. `h-[280px]` or
          // `max-h-[280px]`) breaks Vaul's positioning and the drawer ends
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
  )
}

"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"

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

/**
 * Generic mobile composer sheet — Vaul drawer + snap math + recording
 * lock + focus-trap escape + auto-collapse-after-submit. Doesn't know
 * about notes vs discussions; the caller passes the body/peek surfaces
 * via slot props so the same shell hosts either composer.
 *
 * State ownership: snap and recording state are lifted to the workspace
 * (so it can derive sticky-video signals without callback round-trips).
 * The caller also passes `draftText` + `isPending` so the auto-collapse
 * logic can detect a successful text submit (pending true→false with an
 * empty draft = clean submit; the parent cleared the text on success).
 */
export type MobileComposerSheetProps = {
  // ── Generic snap state, owned by the workspace ───────────────────────
  snap: ComposerSnap
  onSnapChange: (next: ComposerSnap) => void

  // ── Recording lock ───────────────────────────────────────────────────
  // True during voice countdown/recording (not while uploading). Locks
  // dismissal so accidental swipes can't kill an in-flight take.
  isRecording: boolean

  // ── Auto-collapse trigger ────────────────────────────────────────────
  // Compare draftText empty + pending true→false to detect a clean
  // submit. The caller is responsible for clearing the draft on success
  // (errors keep the text in place so the user can retry without
  // re-typing). Voice-side callers should snap-to-peek themselves in
  // their entity-creation success path; this auto-collapse only fires
  // for text submits.
  draftText: string
  isPending: boolean

  // ── Slots ────────────────────────────────────────────────────────────
  /** Rendered when the sheet is at the peek snap. */
  peek: ReactNode
  /** Rendered when the sheet is expanded (any non-peek snap). */
  body: ReactNode

  // ── A11y ─────────────────────────────────────────────────────────────
  /** Sheet aria-label. Defaults to "Add a note". */
  ariaLabel?: string
  ariaDescription?: string
}

type Snap = number | string | null

export function MobileComposerSheet({
  snap,
  onSnapChange,
  isRecording,
  draftText,
  isPending,
  peek,
  body,
  ariaLabel = "Add a note",
  ariaDescription = "Compose a text or voice note anchored to the current video time.",
}: Readonly<MobileComposerSheetProps>) {
  // Auto-collapse to peek after a successful text submit. Detects the
  // pending: true → false transition combined with empty text (errors keep
  // the text in place, success clears it in the parent). Tracked through a
  // ref + effect rather than a derived-state-in-render block — calling the
  // parent's `onSnapChange` setter during render triggers React's
  // "Cannot update a component while rendering a different component"
  // warning. The effect runs after commit, which is the right phase for
  // dispatching parent-state updates.
  const wasPendingRef = useRef(isPending)
  useEffect(() => {
    const justFinished = wasPendingRef.current && !isPending
    wasPendingRef.current = isPending
    if (
      justFinished &&
      draftText.trim().length === 0 &&
      snap !== COMPOSER_PEEK_SNAP
    ) {
      onSnapChange(COMPOSER_PEEK_SNAP)
    }
  }, [isPending, draftText, snap, onSnapChange])

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

  const isPeek = snap === COMPOSER_PEEK_SNAP

  // Vaul's `modal={false}` prop only affects Vaul's own pointer-down
  // and focus-outside handlers — it does NOT propagate to the underlying
  // Radix `DialogPrimitive.Root`, which always renders in modal mode
  // (engaging Radix's FocusScope). FocusScope traps focus inside the
  // drawer by registering `focusin` AND `focusout` listeners on the
  // document. The actual snap-back happens in the `focusout` handler:
  // when focus leaves the drawer, Radix synchronously refocuses the
  // last drawer element. That makes interactive elements on the page
  // (e.g. comment composer textareas) impossible to click into while
  // the sheet is open.
  //
  // Escape it by adding capture-phase listeners for BOTH events that
  // run before Radix's bubble-phase listeners and `stopImmediatePropagation`
  // when focus is moving to an element outside the drawer:
  //   - `focusin`  — check `e.target` (where focus is landing now)
  //   - `focusout` — check `e.relatedTarget` (where focus is going next)
  // `focusout` is the load-bearing one — Radix's `focusin` handler only
  // tracks `lastFocusedElementRef` and doesn't perform the refocus —
  // but we silence both for symmetry and to keep `lastFocusedElementRef`
  // from racing with the user's tap target.
  useEffect(() => {
    const isOutsideDrawer = (target: Element | null): boolean => {
      if (!target) return false
      // Vaul tags its content element with `data-vaul-drawer`. Anything
      // outside that subtree is fair game for focus.
      const drawer = document.querySelector("[data-vaul-drawer]")
      return drawer !== null && !drawer.contains(target)
    }
    const handleFocusIn = (e: FocusEvent) => {
      if (isOutsideDrawer(e.target as Element | null)) {
        e.stopImmediatePropagation()
      }
    }
    const handleFocusOut = (e: FocusEvent) => {
      if (isOutsideDrawer(e.relatedTarget as Element | null)) {
        e.stopImmediatePropagation()
      }
    }
    document.addEventListener("focusin", handleFocusIn, true)
    document.addEventListener("focusout", handleFocusOut, true)
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true)
      document.removeEventListener("focusout", handleFocusOut, true)
    }
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
          aria-label={ariaLabel}
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
            {ariaLabel}
          </DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            {ariaDescription}
          </DrawerPrimitive.Description>

          {isPeek ? (
            peek
          ) : (
            <div className="flex-1 overflow-y-auto">{body}</div>
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}

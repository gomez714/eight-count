"use client";

import { Film, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { UploadVideoForm } from "../upload-video-form";

type NoVideoBannerProps = {
  rehearsalId: string;
  /**
   * Staff (ADMIN / INSTRUCTOR / ASSISTANT) get an "Upload video" CTA
   * that opens the same dialog as the rehearsal actions menu.
   * Dancers see a passive read-only message — they can't upload.
   */
  canManageVideo: boolean;
};

// Per-rehearsal localStorage key. Per-rehearsal so dismissing on one
// rehearsal doesn't suppress the banner on another. Per-device because
// the dismissal is a "not right now" signal, not a profile preference —
// fine if it reappears on a fresh browser. The rehearsal actions menu's
// "Upload video" item stays available either way as the staff fallback.
function dismissedStorageKey(rehearsalId: string): string {
  return `noVideoBanner:dismissed:${rehearsalId}`;
}

/**
 * Top-of-workspace card that surfaces the "no rehearsal video yet"
 * state. Sits above the Notes/Discussions tab switcher so it's the
 * first thing the user sees and visually fills the space the video
 * card occupies when one exists.
 *
 * Staff get a primary "Upload video" button that opens a Dialog with
 * the existing `UploadVideoForm` (same flow as the rehearsal actions
 * menu's "Upload video" item — one source of truth for the upload UX,
 * just surfaced more prominently here so it's discoverable without
 * the user having to know about the overflow menu).
 *
 * Dismissible via the top-right `X`. Dismissal is persisted in
 * `localStorage` per-rehearsal. After dismissal, staff still have the
 * "Upload video" item in the rehearsal actions menu; dancers have a
 * quieter workspace. Banner re-mounts (and re-reads the dismissal flag)
 * if a video is added and later removed — accepted edge case since
 * video deletion is rare and the actions menu remains discoverable.
 *
 * Removing this banner once a video lands: handled by the parent —
 * `RehearsalWorkspace` only mounts it when `hasVideo` is false.
 */
export function NoVideoBanner({
  rehearsalId,
  canManageVideo,
}: Readonly<NoVideoBannerProps>) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  // SSR / pre-hydration: banner renders. On mount, sync from
  // localStorage. The brief flash if a returning user previously
  // dismissed is acceptable — better than a hydration mismatch from
  // reading localStorage during render.
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    try {
      const stored = globalThis.localStorage.getItem(
        dismissedStorageKey(rehearsalId)
      );
      if (stored === "1") setIsDismissed(true);
    } catch {
      // localStorage can throw in private-mode Safari and a few other
      // hardened browsers. Silently fall through — the banner will just
      // be non-persistent there.
    }
  }, [rehearsalId]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      globalThis.localStorage.setItem(dismissedStorageKey(rehearsalId), "1");
    } catch {
      // Same fallback as the read — dismissal still works for this
      // session even if persistence is blocked.
    }
  };

  if (isDismissed) return null;

  return (
    <>
      <div className="relative flex flex-col items-start gap-3 rounded-lg border border-dashed bg-card p-4 pr-10 sm:flex-row sm:items-center sm:gap-5 sm:p-6 sm:pr-12">
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground sm:size-11"
        >
          <Film className="size-4 sm:size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold sm:text-base">
            No rehearsal video yet
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {canManageVideo
              ? "You can still capture notes and discussions. Upload a video any time to enable timestamped feedback and synced voice playback. The upload option also lives in the rehearsal actions menu above — safe to dismiss this card."
              : "Your instructor hasn't uploaded the rehearsal video yet. You can still join discussions and review notes assigned to you."}
          </p>
        </div>
        {canManageVideo ? (
          <Button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            size="sm"
            className="sm:ml-auto sm:size-default"
          >
            <Upload aria-hidden className="size-4" />
            Upload video
          </Button>
        ) : null}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={
            canManageVideo
              ? "Dismiss this notice — upload is still available from the actions menu"
              : "Dismiss this notice"
          }
          title={
            canManageVideo
              ? "Dismiss — upload is still available from the actions menu above"
              : "Dismiss this notice"
          }
          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {canManageVideo ? (
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload rehearsal video</DialogTitle>
              <DialogDescription>
                Upload one rehearsal video for this rehearsal.
              </DialogDescription>
            </DialogHeader>
            <UploadVideoForm
              rehearsalId={rehearsalId}
              submitLabel="Upload video"
              pendingLabel="Uploading..."
              onCompleted={() => setIsUploadOpen(false)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

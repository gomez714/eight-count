"use client";

import { MoreHorizontal, Pencil, RefreshCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { EditRehearsalForm } from "./edit-rehearsal-form";
import { UploadVideoForm } from "./upload-video-form";

type RehearsalActionsMenuProps = {
  rehearsalId: string;
  hasExistingVideo: boolean;
  rehearsalTitle: string;
  rehearsalDescription: string | null;
  rehearsalDate: Date;
};

export function RehearsalActionsMenu({
  rehearsalId,
  hasExistingVideo,
  rehearsalTitle,
  rehearsalDescription,
  rehearsalDate,
}: Readonly<RehearsalActionsMenuProps>) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Rehearsal actions"
            className="size-8"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setIsEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setIsReplaceOpen(true);
            }}
          >
            <RefreshCcw className="size-4" />
            {hasExistingVideo ? "Replace video" : "Upload video"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit rehearsal</DialogTitle>
            <DialogDescription>
              Update the rehearsal title, date, or description.
            </DialogDescription>
          </DialogHeader>

          <EditRehearsalForm
            rehearsalId={rehearsalId}
            initialTitle={rehearsalTitle}
            initialDescription={rehearsalDescription}
            initialRehearsalDate={rehearsalDate}
            onSuccess={() => setIsEditOpen(false)}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isReplaceOpen} onOpenChange={setIsReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hasExistingVideo ? "Replace rehearsal video" : "Upload rehearsal video"}
            </DialogTitle>
            <DialogDescription>
              {hasExistingVideo
                ? "Uploading a new file replaces the current rehearsal video. Existing notes keep their timestamps but may no longer line up with the new footage."
                : "Upload one rehearsal video for this rehearsal."}
            </DialogDescription>
          </DialogHeader>

          <UploadVideoForm
            rehearsalId={rehearsalId}
            submitLabel={hasExistingVideo ? "Replace video" : "Upload video"}
            pendingLabel="Uploading..."
            onCompleted={() => setIsReplaceOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

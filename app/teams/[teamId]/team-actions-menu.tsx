"use client";

import { MoreHorizontal, Pencil } from "lucide-react";
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

import { EditTeamForm } from "./edit-team-form";

type TeamActionsMenuProps = {
  teamId: string;
  teamName: string;
  /**
   * Swap "team" → "workspace" in the menu item, dialog title, and
   * description copy when the page is in personal-workspace mode.
   * The underlying rename action is identical in either case.
   */
  isPersonal?: boolean;
};

export function TeamActionsMenu({
  teamId,
  teamName,
  isPersonal = false,
}: Readonly<TeamActionsMenuProps>) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const noun = isPersonal ? "workspace" : "team";
  const renameLabel = isPersonal ? "Rename workspace" : "Rename team";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${noun.charAt(0).toUpperCase() + noun.slice(1)} actions`}
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
            {renameLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameLabel}</DialogTitle>
            <DialogDescription>
              This updates the {noun} name everywhere it appears.
            </DialogDescription>
          </DialogHeader>

          <EditTeamForm
            teamId={teamId}
            initialName={teamName}
            onSuccess={() => setIsEditOpen(false)}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

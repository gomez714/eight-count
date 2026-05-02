"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { AddTeamMemberForm } from "./add-team-member-form";

type InviteMemberButtonProps = {
  teamId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  label?: string;
  className?: string;
};

export function InviteMemberButton({
  teamId,
  variant = "outline",
  size = "sm",
  label = "Add member",
  className,
}: Readonly<InviteMemberButtonProps>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className}>
          <Plus aria-hidden className="size-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Add an existing user to this team by email and assign their role.
          </DialogDescription>
        </DialogHeader>

        <AddTeamMemberForm
          teamId={teamId}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

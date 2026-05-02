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

import { CreateProjectForm } from "./create-project-form";

type NewProjectButtonProps = {
  teamId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  label?: string;
  className?: string;
};

export function NewProjectButton({
  teamId,
  variant = "default",
  size = "default",
  label = "New project",
  className,
}: Readonly<NewProjectButtonProps>) {
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
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project is a piece, routine, or show. Rehearsals and notes live
            inside it.
          </DialogDescription>
        </DialogHeader>

        <CreateProjectForm
          teamId={teamId}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

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

import { CreateRehearsalForm } from "./create-rehearsal-form";

type NewRehearsalButtonProps = {
  projectId: string;
  variant?: "default" | "outline";
  size?: "sm" | "default" | "lg";
  label?: string;
  className?: string;
};

export function NewRehearsalButton({
  projectId,
  variant = "default",
  size = "default",
  label = "New rehearsal",
  className,
}: Readonly<NewRehearsalButtonProps>) {
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
          <DialogTitle>New rehearsal</DialogTitle>
          <DialogDescription>
            Add a rehearsal session under this project. You&apos;ll upload the
            video on the rehearsal page.
          </DialogDescription>
        </DialogHeader>

        <CreateRehearsalForm
          projectId={projectId}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

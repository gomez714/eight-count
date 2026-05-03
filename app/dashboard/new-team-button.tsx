"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
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

import { CreateTeamForm } from "./create-team-form";

type NewTeamButtonProps = {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  label?: string;
  className?: string;
  /**
   * If true, navigate to /teams/[id] after creation. If false, just close
   * the dialog and refresh the page so the new team appears in the list.
   */
  navigateOnSuccess?: boolean;
};

export function NewTeamButton({
  variant = "outline",
  size = "sm",
  label = "New team",
  className,
  navigateOnSuccess = false,
}: Readonly<NewTeamButtonProps>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSuccess = ({ teamId }: { teamId: string }) => {
    setOpen(false);
    if (navigateOnSuccess) {
      router.push(`/teams/${teamId}`);
    }
    router.refresh();
  };

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
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Start a new workspace where you&apos;re the admin. You can invite
            members and create projects right after.
          </DialogDescription>
        </DialogHeader>

        <CreateTeamForm
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

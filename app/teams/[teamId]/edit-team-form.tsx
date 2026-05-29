"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { updateTeam } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const editTeamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters."),
});

type EditTeamFormValues = z.infer<typeof editTeamSchema>;

type EditTeamFormProps = {
  teamId: string;
  initialName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function EditTeamForm({
  teamId,
  initialName,
  onSuccess,
  onCancel,
}: Readonly<EditTeamFormProps>) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditTeamFormValues>({
    resolver: zodResolver(editTeamSchema),
    defaultValues: {
      name: initialName,
    },
  });

  const onSubmit = (values: EditTeamFormValues) => {
    if (values.name.trim() === initialName.trim()) {
      onSuccess?.();
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("name", values.name);

      const result = await updateTeam({}, formData);

      if (result?.error) {
        setError("root", { message: result.error });
        return;
      }

      onSuccess?.();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Team name</FieldLabel>
          <FieldContent>
            <Input
              id="name"
              autoFocus
              disabled={isPending}
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldError errors={[errors.name]} />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError errors={[errors.root]} />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

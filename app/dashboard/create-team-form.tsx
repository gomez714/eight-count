"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createTeam } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Team name must be at least 2 characters."),
});

type CreateTeamFormValues = z.infer<typeof createTeamSchema>;

type CreateTeamFormProps = {
  onSuccess?: (result: { teamId: string; teamName: string }) => void;
  onCancel?: () => void;
};

export function CreateTeamForm({
  onSuccess,
  onCancel,
}: Readonly<CreateTeamFormProps> = {}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = (values: CreateTeamFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", values.name);

      const result = await createTeam({}, formData);

      if (result?.error) {
        setError("root", {
          message: result.error,
        });
        return;
      }

      reset();
      if (result.teamId) {
        onSuccess?.({ teamId: result.teamId, teamName: values.name });
      }
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
              placeholder="UCSB Spring Showcase"
              disabled={isPending}
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            <FieldDescription>
              This can be your class, company, team, or production group.
            </FieldDescription>
            <FieldError errors={[errors.name]} />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError errors={[errors.root]} />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create team"}
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

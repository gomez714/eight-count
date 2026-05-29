"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { updateProject } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const editProjectSchema = z.object({
  title: z.string().trim().min(2, "Project title must be at least 2 characters."),
  description: z.string().trim().optional(),
});

type EditProjectFormValues = z.infer<typeof editProjectSchema>;

type EditProjectFormProps = {
  projectId: string;
  initialTitle: string;
  initialDescription: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function EditProjectForm({
  projectId,
  initialTitle,
  initialDescription,
  onSuccess,
  onCancel,
}: Readonly<EditProjectFormProps>) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      title: initialTitle,
      description: initialDescription ?? "",
    },
  });

  const onSubmit = (values: EditProjectFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("title", values.title);
      formData.append("description", values.description || "");

      const result = await updateProject({}, formData);

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
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="title">Project title</FieldLabel>
          <FieldContent>
            <Input
              id="title"
              autoFocus
              disabled={isPending}
              aria-invalid={!!errors.title}
              {...register("title")}
            />
            <FieldError errors={[errors.title]} />
          </FieldContent>
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <FieldContent>
            <Input
              id="description"
              placeholder="Optional notes about this project"
              disabled={isPending}
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldError errors={[errors.description]} />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError errors={[errors.root]} />

      <div className="flex flex-wrap items-center gap-2">
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

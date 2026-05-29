"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { updateRehearsal } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const editRehearsalSchema = z.object({
  title: z.string().trim().min(2, "Rehearsal title must be at least 2 characters."),
  description: z.string().trim().optional(),
  rehearsalDate: z.string().min(1, "Rehearsal date is required."),
});

type EditRehearsalFormValues = z.infer<typeof editRehearsalSchema>;

type EditRehearsalFormProps = {
  rehearsalId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialRehearsalDate: Date;
  onSuccess?: () => void;
  onCancel?: () => void;
};

// datetime-local inputs expect "YYYY-MM-DDTHH:MM" in the user's local time.
function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditRehearsalForm({
  rehearsalId,
  initialTitle,
  initialDescription,
  initialRehearsalDate,
  onSuccess,
  onCancel,
}: Readonly<EditRehearsalFormProps>) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditRehearsalFormValues>({
    resolver: zodResolver(editRehearsalSchema),
    defaultValues: {
      title: initialTitle,
      description: initialDescription ?? "",
      rehearsalDate: toLocalDateTimeInput(initialRehearsalDate),
    },
  });

  const onSubmit = (values: EditRehearsalFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("rehearsalId", rehearsalId);
      formData.append("title", values.title);
      formData.append("description", values.description || "");
      formData.append("rehearsalDate", values.rehearsalDate);

      const result = await updateRehearsal({}, formData);

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
          <FieldLabel htmlFor="title">Rehearsal title</FieldLabel>
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

        <Field data-invalid={!!errors.rehearsalDate}>
          <FieldLabel htmlFor="rehearsalDate">Rehearsal date</FieldLabel>
          <FieldContent>
            <Input
              id="rehearsalDate"
              type="datetime-local"
              disabled={isPending}
              aria-invalid={!!errors.rehearsalDate}
              {...register("rehearsalDate")}
            />
            <FieldError errors={[errors.rehearsalDate]} />
          </FieldContent>
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <FieldContent>
            <Input
              id="description"
              placeholder="Optional notes about this rehearsal"
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

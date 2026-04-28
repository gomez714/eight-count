"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createRehearsal } from "./actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const createRehearsalSchema = z.object({
  title: z.string().trim().min(2, "Rehearsal title must be at least 2 characters."),
  description: z.string().trim().optional(),
  rehearsalDate: z.string().min(1, "Rehearsal date is required."),
});

type CreateRehearsalFormValues = z.infer<typeof createRehearsalSchema>;

export function CreateRehearsalForm({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateRehearsalFormValues>({
    resolver: zodResolver(createRehearsalSchema),
    defaultValues: {
      title: "",
      description: "",
      rehearsalDate: "",
    },
  });

  const onSubmit = (values: CreateRehearsalFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("title", values.title);
      formData.append("description", values.description || "");
      formData.append("rehearsalDate", values.rehearsalDate);

      const result = await createRehearsal({}, formData);

      if (result?.error) {
        setError("root", {
          message: result.error,
        });
        return;
      }

      reset();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a rehearsal</CardTitle>
        <CardDescription>
          Add a rehearsal session under this project.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Rehearsal title</FieldLabel>
              <FieldContent>
                <Input
                  id="title"
                  placeholder="March 10 run-through"
                  disabled={isPending}
                  aria-invalid={!!errors.title}
                  {...register("title")}
                />
                <FieldDescription>
                  Give this rehearsal a name you can recognize later.
                </FieldDescription>
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

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create rehearsal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
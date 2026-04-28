"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createProject } from "./actions";

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

const createProjectSchema = z.object({
  title: z.string().trim().min(2, "Project title must be at least 2 characters."),
  description: z.string().trim().optional(),
});

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

export function CreateProjectForm({ teamId }: { teamId: string }) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const onSubmit = (values: CreateProjectFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("title", values.title);
      formData.append("description", values.description || "");

      const result = await createProject({}, formData);

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
        <CardTitle>Create a project</CardTitle>
        <CardDescription>
          Add a piece, routine, or work under this team.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Project title</FieldLabel>
              <FieldContent>
                <Input
                  id="title"
                  placeholder="Spring Showcase Opener"
                  disabled={isPending}
                  aria-invalid={!!errors.title}
                  {...register("title")}
                />
                <FieldDescription>
                  This could be a piece, routine, number, or performance work.
                </FieldDescription>
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

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { addTeamMember } from "./member-actions";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const addTeamMemberSchema = z.object({
  email: z.email("Please enter a valid email address.").transform((value) =>
    value.trim().toLowerCase()
  ),
  role: z.enum(["ADMIN", "INSTRUCTOR", "ASSISTANT", "DANCER"]),
});

type AddTeamMemberFormValues = z.infer<typeof addTeamMemberSchema>;

const ROLE_LABELS: Record<AddTeamMemberFormValues["role"], string> = {
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  ASSISTANT: "Assistant",
  DANCER: "Dancer",
};

type AddTeamMemberFormProps = {
  teamId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function AddTeamMemberForm({
  teamId,
  onSuccess,
  onCancel,
}: Readonly<AddTeamMemberFormProps>) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddTeamMemberFormValues>({
    resolver: zodResolver(addTeamMemberSchema),
    defaultValues: {
      email: "",
      role: "DANCER",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = (values: AddTeamMemberFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("email", values.email);
      formData.append("role", values.role);

      const result = await addTeamMember({}, formData);

      if (result?.error) {
        setError("root", {
          message: result.error,
        });
        return;
      }

      toast.success(
        `Added ${values.email} as ${ROLE_LABELS[values.role]}.`
      );

      reset({
        email: "",
        role: "DANCER",
      });
      onSuccess?.();
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <FieldContent>
            <Input
              id="email"
              type="email"
              placeholder="dancer@example.com"
              disabled={isPending}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldDescription>
              The user must already have an account in the app.
            </FieldDescription>
            <FieldError errors={[errors.email]} />
          </FieldContent>
        </Field>

        <Field data-invalid={!!errors.role}>
          <FieldLabel htmlFor="role">Role</FieldLabel>
          <FieldContent>
            <Select
              value={selectedRole}
              onValueChange={(value) =>
                setValue("role", value as AddTeamMemberFormValues["role"], {
                  shouldValidate: true,
                })
              }
              disabled={isPending}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                <SelectItem value="ASSISTANT">Assistant</SelectItem>
                <SelectItem value="DANCER">Dancer</SelectItem>
              </SelectContent>
            </Select>
            <FieldError errors={[errors.role]} />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError errors={[errors.root]} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding..." : "Add team member"}
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

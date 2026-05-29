"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { inviteTeamMember } from "./member-actions";

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

const inviteMemberSchema = z.object({
  email: z.email("Please enter a valid email address.").transform((value) =>
    value.trim().toLowerCase()
  ),
  role: z.enum(["ADMIN", "INSTRUCTOR", "ASSISTANT", "DANCER"]),
});

type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

type InviteMemberFormProps = {
  teamId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function AddTeamMemberForm({
  teamId,
  onSuccess,
  onCancel,
}: Readonly<InviteMemberFormProps>) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: "",
      role: "DANCER",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = (values: InviteMemberFormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("email", values.email);
      formData.append("role", values.role);

      const result = await inviteTeamMember({}, formData);

      if (result?.error) {
        setError("root", {
          message: result.error,
        });
        return;
      }

      if (result.promotedToTeam) {
        toast.success(
          `Invitation sent to ${values.email} — welcome to team mode!`,
          {
            description:
              "Now that you're inviting collaborators, you can manage roles and assignments from the team page.",
          }
        );
      } else {
        toast.success(`Invitation sent to ${values.email}.`);
      }

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
              We&apos;ll email them a link to join the team.
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
                setValue("role", value as InviteMemberFormValues["role"], {
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
          {isPending ? "Sending…" : "Send invitation"}
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

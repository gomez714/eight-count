"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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

import { bootstrapFirstWorkspace } from "./actions";

const wizardSchema = z.object({
  workspaceName: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters."),
  projectTitle: z
    .string()
    .trim()
    .min(2, "Show name must be at least 2 characters."),
  rehearsalTitle: z
    .string()
    .trim()
    .min(2, "Rehearsal name must be at least 2 characters."),
});

type WizardFormValues = z.infer<typeof wizardSchema>;

type WelcomeWizardProps = {
  firstName: string | null;
  defaultWorkspaceName: string;
  defaultProjectTitle: string;
  defaultRehearsalTitle: string;
};

export function WelcomeWizard({
  firstName,
  defaultWorkspaceName,
  defaultProjectTitle,
  defaultRehearsalTitle,
}: Readonly<WelcomeWizardProps>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      workspaceName: defaultWorkspaceName,
      projectTitle: defaultProjectTitle,
      rehearsalTitle: defaultRehearsalTitle,
    },
  });

  const runBootstrap = (values: WizardFormValues | Record<string, never>) => {
    startTransition(async () => {
      const result = await bootstrapFirstWorkspace(values);

      if ("error" in result) {
        setError("root", { message: result.error });
        return;
      }

      router.push(`/rehearsals/${result.rehearsalId}`);
      router.refresh();
    });
  };

  const onSubmit = (values: WizardFormValues) => runBootstrap(values);
  const onSkip = () => runBootstrap({});

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome, ${firstName}!` : "Welcome!"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Let&apos;s get your first rehearsal up. We&apos;ve filled in some
          defaults — change anything that doesn&apos;t fit, or skip ahead and
          rename later.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FieldGroup>
          <Field data-invalid={!!errors.workspaceName}>
            <FieldLabel htmlFor="workspaceName">Workspace name</FieldLabel>
            <FieldContent>
              <Input
                id="workspaceName"
                disabled={isPending}
                aria-invalid={!!errors.workspaceName}
                {...register("workspaceName")}
              />
              <FieldDescription>
                Your team&apos;s home — you can rename it anytime.
              </FieldDescription>
              <FieldError errors={[errors.workspaceName]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.projectTitle}>
            <FieldLabel htmlFor="projectTitle">Show or project</FieldLabel>
            <FieldContent>
              <Input
                id="projectTitle"
                disabled={isPending}
                aria-invalid={!!errors.projectTitle}
                {...register("projectTitle")}
              />
              <FieldDescription>
                What you&apos;re rehearsing — a piece, a routine, a showcase.
              </FieldDescription>
              <FieldError errors={[errors.projectTitle]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.rehearsalTitle}>
            <FieldLabel htmlFor="rehearsalTitle">First rehearsal</FieldLabel>
            <FieldContent>
              <Input
                id="rehearsalTitle"
                disabled={isPending}
                aria-invalid={!!errors.rehearsalTitle}
                {...register("rehearsalTitle")}
              />
              <FieldDescription>
                We&apos;ll set today&apos;s date automatically.
              </FieldDescription>
              <FieldError errors={[errors.rehearsalTitle]} />
            </FieldContent>
          </Field>
        </FieldGroup>

        <FieldError errors={[errors.root]} />

        <div className="flex flex-col items-center gap-3">
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={isPending}
          >
            {isPending ? "Setting up…" : "Continue →"}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            disabled={isPending}
            className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip and use defaults
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Next: upload your first rehearsal video and start leaving notes.
      </p>
    </div>
  );
}

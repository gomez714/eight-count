"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
import { clerkErrorMessage } from "@/lib/auth/clerk-error-message";

const SAFE_REDIRECT_PREFIX = "/";
const DEFAULT_REDIRECT = "/dashboard";
const SUPPORT_EMAIL = "lgomez00714@gmail.com";
// If `signUp.sso()` doesn't navigate away within this window, the SDK is
// most likely stuck on stale state from a prior failed attempt. Watchdog
// resets busy state and surfaces an actionable error.
const OAUTH_TIMEOUT_MS = 6000;

const RESEND_LABELS = {
  idle: "Resend code",
  sending: "Sending…",
  sent: "Code sent ✓",
} as const;

const signUpSchema = z.object({
  emailAddress: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
  // Eight Count is currently restricted to adult users (18+) — see /privacy
  // ("Who Eight Count is for"). The checkbox is the lightweight gate; the
  // disclaimer in the form copy reinforces the requirement upstream.
  confirmAdult: z
    .boolean()
    .refine((value) => value === true, {
      message: "Please confirm you're 18 or older.",
    }),
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

const verifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/u, "Enter the 6-digit code from your email."),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

/**
 * Headless sign-up using Clerk's "Future" API. Two states: `create`
 * (collect email + password, fire email-verification email) and `verify`
 * (collect 6-digit code, complete account creation). Google OAuth is a
 * separate fast path that skips verification.
 */
export function SignUpForm() {
  const { signUp, fetchStatus } = useSignUp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<"create" | "verify">("create");
  const [pendingEmail, setPendingEmail] = useState("");
  const [isOauthBusy, setIsOauthBusy] = useState(false);

  const redirectAfter = resolveRedirect(searchParams.get("redirect_url"));
  const prefilledEmail = sanitizeEmailParam(searchParams.get("email"));

  if (step === "verify") {
    return (
      <VerifyEmailStep
        email={pendingEmail}
        onComplete={() => {
          // router.push + router.refresh ensures the root layout
          // (AppHeader) re-renders with the freshly-set Clerk session,
          // swapping SignIn/SignUp buttons → UserButton immediately.
          // location.assign did a hard nav but the layout could still
          // paint with stale auth state — see the auth audit notes.
          router.push(redirectAfter);
          router.refresh();
        }}
        onBack={() => setStep("create")}
      />
    );
  }

  return (
    <CreateAccountStep
      isBusyExternal={fetchStatus === "fetching" || isOauthBusy}
      prefilledEmail={prefilledEmail}
      onSubmit={async (values) => {
        const { error } = await signUp.create({
          emailAddress: values.emailAddress,
          password: values.password,
        });
        if (error) {
          console.error("[auth] sign-up create failed:", error);
          return { error: clerkErrorMessage(error) };
        }

        // Branch on signUp.status instead of assuming we're ready to
        // send the verification email. Real users have hit cascades
        // where the first attempt fails (e.g. password breach), and
        // retry inherited a poisoned state — explicit status checks
        // surface that instead of silently misbehaving.
        if (signUp.status === "complete") {
          const { error: finalizeError } = await signUp.finalize();
          if (finalizeError) {
            console.error(
              "[auth] sign-up finalize failed:",
              finalizeError
            );
            return { error: clerkErrorMessage(finalizeError) };
          }
          router.push(redirectAfter);
          router.refresh();
          return { error: null };
        }

        const { error: prepareError } =
          await signUp.verifications.sendEmailCode();
        if (prepareError) {
          console.error(
            "[auth] sign-up sendEmailCode failed:",
            prepareError
          );
          return { error: clerkErrorMessage(prepareError) };
        }

        setPendingEmail(values.emailAddress);
        setStep("verify");
        return { error: null };
      }}
      onGoogle={async () => {
        if (isOauthBusy) return null;
        setIsOauthBusy(true);

        // Watchdog: if sso() doesn't navigate away within the timeout,
        // reset busy and surface an actionable error. Fixes the silent-
        // hang failure mode when signUp is in a stale state.
        const watchdog = setTimeout(() => {
          console.error(
            "[auth] sign-up OAuth didn't initiate within timeout — likely stale signUp state"
          );
          setIsOauthBusy(false);
        }, OAUTH_TIMEOUT_MS);

        try {
          const { error } = await signUp.sso({
            strategy: "oauth_google",
            redirectUrl: redirectAfter,
            redirectCallbackUrl: "/sign-in/sso-callback",
          });
          if (error) {
            clearTimeout(watchdog);
            console.error("[auth] sign-up OAuth failed:", error);
            setIsOauthBusy(false);
            return clerkErrorMessage(error);
          }
          // sso() typically navigates away on success.
          return null;
        } catch (err) {
          clearTimeout(watchdog);
          console.error("[auth] sign-up OAuth threw:", err);
          setIsOauthBusy(false);
          return clerkErrorMessage(err);
        }
      }}
    />
  );
}

type CreateAccountStepProps = {
  isBusyExternal: boolean;
  prefilledEmail: string | null;
  onSubmit: (
    values: SignUpFormValues
  ) => Promise<{ error: string | null }>;
  onGoogle: () => Promise<string | null>;
};

function CreateAccountStep({
  isBusyExternal,
  prefilledEmail,
  onSubmit,
  onGoogle,
}: Readonly<CreateAccountStepProps>) {
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      emailAddress: prefilledEmail ?? "",
      password: "",
      confirmAdult: false,
    },
  });

  const isAdultConfirmed = watch("confirmAdult");

  const handleGoogle = async () => {
    if (!isAdultConfirmed) {
      setError("confirmAdult", {
        message: "Please confirm you're 18 or older.",
      });
      return;
    }
    const errorMessage = await onGoogle();
    if (errorMessage) {
      setError("root", { message: errorMessage });
    }
  };

  const handleFormSubmit = async (values: SignUpFormValues) => {
    const result = await onSubmit(values);
    if (result.error) {
      setError("root", { message: result.error });
    }
  };

  const isBusy = isSubmitting || isBusyExternal;

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h2>
        <p className="text-sm text-muted-foreground">
          Eight Count is in beta — get your team in early.
        </p>
      </div>

      {/* Beta + age confirmation. Gates both Google OAuth and email sign-up:
          handleGoogle short-circuits if the box is unchecked, and Zod
          validation on form submit enforces the same requirement. */}
      <div className="flex flex-col gap-2.5 rounded-md border bg-card/40 p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Eight Count is in beta and currently limited to dancers 18 and over.{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline decoration-dotted underline-offset-4 hover:decoration-solid"
          >
            Why?
          </Link>
        </p>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
            disabled={isBusy}
            aria-invalid={!!errors.confirmAdult}
            aria-describedby={
              errors.confirmAdult ? "confirm-adult-error" : undefined
            }
            {...register("confirmAdult")}
          />
          <span className="text-foreground">I confirm I&apos;m 18 or older.</span>
        </label>
        {errors.confirmAdult ? (
          <p
            id="confirm-adult-error"
            className="text-xs text-destructive"
          >
            {errors.confirmAdult.message}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full"
        onClick={handleGoogle}
        disabled={isBusy}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <Divider>or</Divider>

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-5"
      >
        <FieldGroup>
          <Field data-invalid={!!errors.emailAddress}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={isBusy}
                readOnly={!!prefilledEmail}
                aria-invalid={!!errors.emailAddress}
                {...register("emailAddress")}
              />
              {prefilledEmail ? (
                <FieldDescription>
                  Locked to your invited email.
                </FieldDescription>
              ) : null}
              <FieldError errors={[errors.emailAddress]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <FieldContent>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isBusy}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              <FieldDescription>
                At least 8 characters. Passwords are checked against known
                data breaches — if yours is rejected, just pick a different one.
              </FieldDescription>
              <FieldError errors={[errors.password]} />
            </FieldContent>
          </Field>
        </FieldGroup>

        <FieldError errors={[errors.root]} />

        <Button
          type="submit"
          className="w-full rounded-full"
          disabled={isBusy}
        >
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div id="clerk-captcha" />

      <p className="text-center text-xs text-muted-foreground">
        By creating an account you agree to use Eight Count for its intended
        purpose: leaving timestamped notes on rehearsal videos.
      </p>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll receive a daily email digest when there&apos;s new
        activity to see. We skip days when there&apos;s nothing — and you
        can turn it off anytime in{" "}
        <Link
          href="/settings/notifications"
          className="underline decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid"
        >
          email preferences
        </Link>
        .
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-primary hover:text-primary/80"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Having trouble?{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Sign-up%20help`}
          className="underline decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid"
        >
          Email {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}

type VerifyEmailStepProps = {
  email: string;
  onComplete: () => void;
  onBack: () => void;
};

function VerifyEmailStep({
  email,
  onComplete,
  onBack,
}: Readonly<VerifyEmailStepProps>) {
  const { signUp } = useSignUp();
  const [resendState, setResendState] = useState<
    "idle" | "sending" | "sent"
  >("idle");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: VerifyFormValues) => {
    const { error } = await signUp.verifications.verifyEmailCode({
      code: values.code,
    });

    if (error) {
      console.error("[auth] sign-up verify failed:", error);
      setError("root", { message: clerkErrorMessage(error) });
      return;
    }

    if (signUp.status === "complete") {
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        console.error("[auth] sign-up finalize failed:", finalizeError);
        setError("root", { message: clerkErrorMessage(finalizeError) });
        return;
      }
      onComplete();
      return;
    }

    console.error(
      "[auth] sign-up verify non-complete status:",
      signUp.status
    );
    setError("root", {
      message:
        "Verification didn’t complete. Try again or request a new code.",
    });
  };

  const handleResend = async () => {
    if (resendState === "sending") return;
    setResendState("sending");
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) {
      console.error("[auth] sign-up resend code failed:", error);
      setResendState("idle");
      setError("root", { message: clerkErrorMessage(error) });
      return;
    }
    setResendState("sent");
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>. Enter
          it below to finish creating your account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field data-invalid={!!errors.code}>
          <FieldLabel htmlFor="code">Verification code</FieldLabel>
          <FieldContent>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              disabled={isSubmitting}
              aria-invalid={!!errors.code}
              {...register("code")}
            />
            <FieldError errors={[errors.code]} />
          </FieldContent>
        </Field>

        <FieldError errors={[errors.root]} />

        <Button
          type="submit"
          className="w-full rounded-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Verifying…" : "Verify and continue"}
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Use a different email
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendState !== "idle"}
          className="font-medium text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {RESEND_LABELS[resendState]}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Code not arriving?{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Sign-up%20help`}
          className="underline decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid"
        >
          Email {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}

function Divider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {children}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.42-1.1 2.62-2.34 3.43v2.85h3.78c2.21-2.04 3.49-5.05 3.49-8.52z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.16 0 5.81-1.04 7.74-2.81l-3.78-2.85c-1.05.7-2.39 1.12-3.96 1.12-3.05 0-5.62-2.06-6.55-4.83H1.55v3.04C3.46 21.3 7.41 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.45 14.63c-.24-.7-.37-1.45-.37-2.23s.13-1.53.37-2.23V7.13H1.55C.56 9.06 0 11.21 0 13.5s.56 4.44 1.55 6.37l3.9-3.04z"
      />
      <path
        fill="#EA4335"
        d="M12 4.84c1.72 0 3.27.59 4.49 1.75l3.36-3.36C17.81 1.18 15.16 0 12 0 7.41 0 3.46 2.7 1.55 6.63l3.9 3.04C6.38 6.9 8.95 4.84 12 4.84z"
      />
    </svg>
  );
}

function resolveRedirect(input: string | null): string {
  if (!input) return DEFAULT_REDIRECT;
  if (!input.startsWith(SAFE_REDIRECT_PREFIX)) return DEFAULT_REDIRECT;
  if (input.startsWith("//")) return DEFAULT_REDIRECT;
  return input;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function sanitizeEmailParam(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

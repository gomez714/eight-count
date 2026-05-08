"use client";

import { useSignIn } from "@clerk/nextjs";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { clerkErrorMessage } from "@/lib/auth/clerk-error-message";

const SAFE_REDIRECT_PREFIX = "/";
const DEFAULT_REDIRECT = "/dashboard";
const SUPPORT_EMAIL = "lgomez00714@gmail.com";
// If `signIn.sso()` doesn't navigate away within this window, surface a
// soft error and reset the form. Clerk's SDK can hang silently when the
// sign-in resource is in a stale state from a prior failed attempt — this
// timeout makes that recoverable without a hard refresh.
const OAUTH_TIMEOUT_MS = 6000;

const signInSchema = z.object({
  emailAddress: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type SignInFormValues = z.infer<typeof signInSchema>;

/**
 * Headless sign-in form using Clerk's "Future" API (`useSignIn` →
 * `SignInFutureResource`). UI is 100% in our design system; Clerk handles
 * auth state under the hood.
 *
 * v1 paths:
 * - Email + password (`signIn.create({ identifier, password })`)
 * - Google OAuth (`signIn.sso({ strategy: 'oauth_google', ... })`)
 * - Deep-link preservation via `?redirect_url=` query param
 *
 * Deferred: forgot password, MFA, magic links.
 */
export function SignInForm() {
  const { signIn, fetchStatus } = useSignIn();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isOauthBusy, setIsOauthBusy] = useState(false);

  const redirectAfter = resolveRedirect(searchParams.get("redirect_url"));

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { emailAddress: "", password: "" },
  });

  const onSubmit = async (values: SignInFormValues) => {
    const { error } = await signIn.create({
      identifier: values.emailAddress,
      password: values.password,
    });

    if (error) {
      console.error("[auth] sign-in create failed:", error);
      setError("root", { message: clerkErrorMessage(error) });
      return;
    }

    if (signIn.status === "complete") {
      const { error: finalizeError } = await signIn.finalize();
      if (finalizeError) {
        console.error("[auth] sign-in finalize failed:", finalizeError);
        setError("root", { message: clerkErrorMessage(finalizeError) });
        return;
      }
      // router.push + router.refresh re-renders the root layout, so
      // AppHeader picks up the freshly-set Clerk session and swaps
      // SignIn/SignUp buttons → UserButton without a manual refresh.
      // The previous `location.assign` did a full page load but the
      // layout's auth state could still be stale on the next paint.
      router.push(redirectAfter);
      router.refresh();
      return;
    }

    // Surface specific non-complete states with actionable guidance
    // instead of the catch-all "additional verification" message that
    // confused real users (see issue tracker).
    console.error("[auth] sign-in non-complete status:", signIn.status);
    if (signIn.status === "needs_second_factor") {
      setError("root", {
        message:
          "This account has two-factor authentication enabled, which isn't supported in this beta yet. Email " +
          SUPPORT_EMAIL +
          " and we'll help you get in.",
      });
      return;
    }
    setError("root", {
      message:
        "Sign-in didn't complete. Refresh the page and try again, or email " +
        SUPPORT_EMAIL +
        " if it keeps happening.",
    });
  };

  const handleGoogle = async () => {
    if (isOauthBusy) return;
    setIsOauthBusy(true);

    // Watchdog: if sso() doesn't navigate away within OAUTH_TIMEOUT_MS,
    // the SDK is most likely stuck on stale state from a prior failed
    // attempt. Surface a real error and reset busy so the user can
    // refresh instead of staring at a frozen form.
    const watchdog = setTimeout(() => {
      console.error(
        "[auth] sign-in OAuth didn't initiate within timeout — likely stale signIn state"
      );
      setIsOauthBusy(false);
      setError("root", {
        message:
          "Couldn't start Google sign-in. Refresh the page and try again — if it keeps happening, email " +
          SUPPORT_EMAIL +
          ".",
      });
    }, OAUTH_TIMEOUT_MS);

    try {
      const { error } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: redirectAfter,
        redirectCallbackUrl: "/sign-in/sso-callback",
      });

      // sso() typically navigates away on success. If it returns with an
      // error, we re-enable the form and show it.
      if (error) {
        clearTimeout(watchdog);
        console.error("[auth] sign-in OAuth failed:", error);
        setIsOauthBusy(false);
        setError("root", { message: clerkErrorMessage(error) });
      }
    } catch (err) {
      clearTimeout(watchdog);
      console.error("[auth] sign-in OAuth threw:", err);
      setIsOauthBusy(false);
      setError("root", { message: clerkErrorMessage(err) });
    }
  };

  const isBusy = isSubmitting || isOauthBusy || fetchStatus === "fetching";

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">
          Sign in to Eight Count to keep going.
        </p>
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

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
                aria-invalid={!!errors.emailAddress}
                {...register("emailAddress")}
              />
              <FieldError errors={[errors.emailAddress]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.password}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="https://accounts.clerk.com/forgot-password"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <FieldContent>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isBusy}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
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
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/*
        Clerk's bot-protection hooks into a CAPTCHA element on the page
        when sign-in / sign-up runs. Mounted but visually inert.
      */}
      <div id="clerk-captcha" />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-primary hover:text-primary/80"
        >
          Sign up
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Having trouble?{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Sign-in%20help`}
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

/**
 * Only allow same-origin internal paths. Protects against `redirect_url`
 * being set to an external host. Falls back to the dashboard.
 */
function resolveRedirect(input: string | null): string {
  if (!input) return DEFAULT_REDIRECT;
  if (!input.startsWith(SAFE_REDIRECT_PREFIX)) return DEFAULT_REDIRECT;
  if (input.startsWith("//")) return DEFAULT_REDIRECT;
  return input;
}

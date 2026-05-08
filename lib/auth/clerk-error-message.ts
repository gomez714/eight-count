/**
 * Maps a Clerk error to a user-facing message. Detects known error codes
 * (most importantly the password-breach check) and rewrites them into
 * actionable language; falls back to Clerk's `longMessage` / `message`
 * for everything else.
 *
 * Why: Clerk's default messages are technically accurate but often
 * confusing — the breach-detection error in particular reads as
 * "your password was leaked somewhere" when the actual fix is "pick a
 * different password." Rewriting the most common cases prevents the
 * cascade we saw where users tried again with the same bad input and got
 * stuck in a poisoned-state loop.
 */

type ClerkErrorLike = {
  code?: string;
  message?: string;
  longMessage?: string;
};

// Known Clerk error codes worth rewriting. Codes are stable across SDK
// versions; messages are not. See https://clerk.com/docs/errors for the
// canonical list — keep additions narrow to user-facing flows.
const KNOWN_MESSAGES: Record<string, string> = {
  form_password_pwned:
    "This password has appeared in a known data breach. Pick a different one — even a small variation works (Clerk checks every password against public breach databases for your safety).",
  form_password_size_in_bytes_exceeded:
    "Password is too long. Try something under 72 characters.",
  form_password_length_too_short:
    "Password must be at least 8 characters.",
  form_identifier_exists:
    "An account with that email already exists. Try signing in instead.",
  form_identifier_not_found:
    "We couldn't find an account with that email. Double-check it, or create a new account.",
  form_password_incorrect:
    "Incorrect password. Try again or use 'Forgot password?'.",
  form_param_format_invalid:
    "One of the fields is formatted incorrectly. Check your inputs and try again.",
  session_exists:
    "You're already signed in. Refresh the page to continue.",
  too_many_requests:
    "Too many attempts. Wait a minute and try again.",
};

export function clerkErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "Something went wrong. Please try again.";
  }

  const err = error as ClerkErrorLike & {
    errors?: ClerkErrorLike[];
  };

  // Some Clerk responses bundle errors in an `errors` array — check the
  // first entry first since it's typically the most specific.
  const primary = err.errors?.[0] ?? err;

  if (primary.code && KNOWN_MESSAGES[primary.code]) {
    return KNOWN_MESSAGES[primary.code];
  }

  return (
    primary.longMessage ??
    primary.message ??
    "Something went wrong. Please try again."
  );
}

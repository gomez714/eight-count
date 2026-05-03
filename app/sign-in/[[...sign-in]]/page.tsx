import { BrandLockup } from "@/components/brand-lockup";

import { SignInForm } from "../sign-in-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col lg:flex-row">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <SignInForm />
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="hidden flex-col gap-6 bg-card lg:flex lg:flex-1 lg:justify-between lg:border-r lg:p-12">
      <BrandLockup size="lg" showCountDots />

      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Pick up where you left off.
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          Your team’s notes are waiting. Sign in to see what’s on your plate,
          who’s still working on what, and where to push next.
        </p>
      </div>

      <p className="max-w-md text-xs text-muted-foreground">
        Eight Count anchors every note to the second of the rehearsal it’s
        about — and tracks each dancer’s progress, one by one.
      </p>
    </div>
  );
}

import { BrandLockup } from "@/components/brand-lockup";

import { SignUpForm } from "../sign-up-form";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col lg:flex-row">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <SignUpForm />
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
          Start your team.
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          Eight Count is in beta. Bring your team in early — it’s free while
          we listen, and you’ll be one of the first shaping where this goes.
        </p>
      </div>

      <p className="max-w-md text-xs text-muted-foreground">
        Time-stamped feedback that finds its dancer. Per-recipient progress.
        Voice notes that sync with the rehearsal video.
      </p>
    </div>
  );
}

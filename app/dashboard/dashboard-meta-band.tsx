import { Inbox, Users } from "lucide-react";
import type { ReactNode } from "react";

type DashboardMetaBandProps = {
  displayName: string | null;
  teamsCount: number;
  onPlateCount: number;
};

export function DashboardMetaBand({
  displayName,
  teamsCount,
  onPlateCount,
}: Readonly<DashboardMetaBandProps>) {
  const greeting = displayName ? `Welcome back, ${displayName}` : "Welcome back";

  return (
    <div className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {greeting}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Here&apos;s a quick look at where things stand across your teams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 sm:gap-x-6 sm:border-t sm:pt-3">
          <MetaChip
            icon={<Users className="size-3.5" />}
            label="Teams"
            value={String(teamsCount)}
            mobileLabel={teamsCount === 1 ? "team" : "teams"}
          />
          <MetaChip
            icon={<Inbox className="size-3.5" />}
            label="On your plate"
            value={String(onPlateCount)}
            mobileLabel="on your plate"
          />
        </div>
      </div>
    </div>
  );
}

type MetaChipProps = {
  icon: ReactNode;
  label: string;
  value: string;
  mobileLabel?: string;
};

function MetaChip({ icon, label, value, mobileLabel }: Readonly<MetaChipProps>) {
  const mobileWord = mobileLabel ?? label.toLowerCase();
  return (
    <>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:hidden">
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span>{mobileWord}</span>
      </span>
      <span className="hidden items-center gap-1.5 leading-tight sm:inline-flex">
        <span aria-hidden className="inline-flex text-muted-foreground">
          {icon}
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </span>
    </>
  );
}

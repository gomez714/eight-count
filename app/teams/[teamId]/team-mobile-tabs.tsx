"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TabKey = "projects" | "members";

type Tab = {
  key: TabKey;
  label: string;
  count: number;
};

type TeamMobileTabsProps = {
  projectCount: number;
  memberCount: number;
  projects: ReactNode;
  members: ReactNode;
};

export function TeamMobileTabs({
  projectCount,
  memberCount,
  projects,
  members,
}: Readonly<TeamMobileTabsProps>) {
  const [tab, setTab] = useState<TabKey>("projects");

  const tabs: Tab[] = [
    { key: "projects", label: "Projects", count: projectCount },
    { key: "members", label: "Members", count: memberCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Team sections"
        className="flex w-full gap-1 rounded-md border border-border bg-muted p-1 lg:hidden"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-4px)] px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card font-semibold text-foreground shadow-sm"
                  : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums",
                  active
                    ? "bg-muted text-muted-foreground"
                    : "bg-card text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        <div
          className={cn("min-w-0", tab === "members" && "hidden lg:block")}
        >
          {projects}
        </div>
        <div
          className={cn("min-w-0", tab === "projects" && "hidden lg:block")}
        >
          {members}
        </div>
      </div>
    </div>
  );
}

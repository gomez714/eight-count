"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TabKey = "rehearsals" | "groups";

type Tab = {
  key: TabKey;
  label: string;
  count: number;
};

type ProjectMobileTabsProps = {
  rehearsalCount: number;
  groupCount: number;
  rehearsals: ReactNode;
  groups: ReactNode;
};

export function ProjectMobileTabs({
  rehearsalCount,
  groupCount,
  rehearsals,
  groups,
}: Readonly<ProjectMobileTabsProps>) {
  const [tab, setTab] = useState<TabKey>("rehearsals");

  const tabs: Tab[] = [
    { key: "rehearsals", label: "Rehearsals", count: rehearsalCount },
    { key: "groups", label: "Groups", count: groupCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Project sections"
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div
          className={cn(
            "flex min-w-0 flex-col gap-6",
            tab === "groups" && "hidden lg:flex"
          )}
        >
          {rehearsals}
        </div>

        <aside
          className={cn(
            "flex flex-col gap-4 lg:sticky lg:top-4",
            tab === "rehearsals" && "hidden lg:flex"
          )}
        >
          {groups}
        </aside>
      </div>
    </div>
  );
}

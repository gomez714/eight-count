"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TabKey = "rehearsals" | "groups" | "resources";

type Tab = {
  key: TabKey;
  label: string;
  count: number;
};

type ProjectMobileTabsProps = {
  rehearsalCount: number;
  groupCount: number;
  resourceCount: number;
  rehearsals: ReactNode;
  groups: ReactNode;
  resources: ReactNode;
};

export function ProjectMobileTabs({
  rehearsalCount,
  groupCount,
  resourceCount,
  rehearsals,
  groups,
  resources,
}: Readonly<ProjectMobileTabsProps>) {
  const [tab, setTab] = useState<TabKey>("rehearsals");

  const tabs: Tab[] = [
    { key: "rehearsals", label: "Rehearsals", count: rehearsalCount },
    { key: "groups", label: "Groups", count: groupCount },
    { key: "resources", label: "Resources", count: resourceCount },
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
                // `min-w-0` is load-bearing — without it the flex item won't
                // shrink below its content's intrinsic width and the count
                // pill spills out of the tablist on small viewports
                // (3 tabs × ~290px content ≤ 320px container).
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[calc(var(--radius-md)-4px)] px-2 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:gap-1.5 sm:px-3 sm:text-sm",
                active
                  ? "bg-card font-semibold text-foreground shadow-sm"
                  : "font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="truncate">{t.label}</span>
              <span
                className={cn(
                  // `shrink-0` keeps the count badge intact — the label
                  // truncates first if the button shrinks further.
                  "inline-flex min-w-4 shrink-0 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums",
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
            tab !== "rehearsals" && "hidden lg:flex"
          )}
        >
          {rehearsals}
        </div>

        {/* Rail. On mobile, hidden entirely when the rehearsals tab is active;
            otherwise shows whichever of Groups / Resources is active. On lg+
            both rail cards stack and the inner conditional classes are
            overridden by `lg:block`. Groups sits above Resources since groups
            drive note targeting (structurally more load-bearing). */}
        <aside
          className={cn(
            "flex flex-col gap-4 lg:sticky lg:top-4",
            tab === "rehearsals" && "hidden lg:flex"
          )}
        >
          <div className={cn(tab === "resources" && "hidden lg:block")}>
            {groups}
          </div>
          <div className={cn(tab === "groups" && "hidden lg:block")}>
            {resources}
          </div>
        </aside>
      </div>
    </div>
  );
}

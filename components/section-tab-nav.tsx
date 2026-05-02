"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type TabKey = "my-notes" | "notes-by-me";

type Tab = {
  key: TabKey;
  label: string;
  href: string;
};

const TABS: ReadonlyArray<Tab> = [
  { key: "my-notes", label: "My notes", href: "/my-notes" },
  { key: "notes-by-me", label: "Notes by me", href: "/notes-by-me" },
];

function deriveActive(pathname: string | null): TabKey | null {
  if (!pathname) return null;
  if (pathname.startsWith("/my-notes")) return "my-notes";
  if (pathname.startsWith("/notes-by-me")) return "notes-by-me";
  return null;
}

type SectionTabNavProps = {
  /** Override the auto-derived active tab (rarely needed). */
  active?: TabKey;
  className?: string;
};

export function SectionTabNav({
  active,
  className,
}: Readonly<SectionTabNavProps>) {
  const pathname = usePathname();
  const activeKey = active ?? deriveActive(pathname);

  return (
    <nav
      aria-label="Notes sections"
      className={cn("border-b bg-background", className)}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-1 px-6">
        {TABS.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative -mb-px inline-flex items-center px-3 py-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring rounded-t-md",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

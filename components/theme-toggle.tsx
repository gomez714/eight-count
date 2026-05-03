"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const TRIGGER_CLASSES = cn(
  "inline-flex size-9 items-center justify-center rounded-md border bg-card text-foreground",
  "transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
);

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // The server can't know the user's resolved theme (it lives in
  // localStorage on the client), so the icon would otherwise mismatch on
  // first paint and React throws a hydration error. Standard next-themes
  // pattern: render an invisible placeholder until mounted, then reveal
  // the real icon. The set-in-effect is intentional and correct here —
  // suppressing the lint rule with a reason.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- next-themes pattern: defer client-only theme to post-hydration to avoid SSR/CSR icon mismatch
    setMounted(true);
  }, []);

  // Pre-mount: invisible placeholder reserves the icon's footprint so the
  // trigger doesn't reflow when the real icon swaps in post-hydration.
  let triggerIcon: React.ReactNode;
  if (!mounted) {
    triggerIcon = <span aria-hidden className="size-4" />;
  } else if (resolvedTheme === "dark") {
    triggerIcon = <Moon aria-hidden className="size-4" />;
  } else {
    triggerIcon = <Sun aria-hidden className="size-4" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Toggle theme"
        className={TRIGGER_CLASSES}
      >
        {triggerIcon}
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden className="size-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden className="size-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden className="size-4" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

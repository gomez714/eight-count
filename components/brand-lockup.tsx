import { AudioLines } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandLockupSize = "sm" | "lg";

type BrandLockupProps = {
  /**
   * Visual scale.
   * - `sm` (default): navbar-sized — `size-7` mark, `text-sm` wordmark,
   *   `size-3.5` icon. Wordmark + icon collapse on mobile (`hidden sm:`).
   * - `lg`: auth-page brand panel — `size-9` mark, `text-lg` wordmark,
   *   `size-4` icon. Always visible (parent decides if the lockup renders).
   */
  size?: BrandLockupSize;
  /**
   * If true, renders eight small dots beneath the wordmark in `--primary`,
   * referencing the dance "eight count". Only meaningful when `size="lg"`
   * since the dots need horizontal room. Auth pages set this to `true`.
   */
  showCountDots?: boolean;
  /**
   * Where the brand link navigates to. Defaults to `/` (landing).
   */
  href?: string;
  className?: string;
};

/**
 * Brand lockup for Eight Count — temporary placeholder until a designed
 * logo lands. Combines:
 *   (A) the "8" mark in `bg-primary` (cohesion with the rest of the app)
 *   (B) eight small dots underneath the wordmark referencing the dance
 *       "eight count" — auth pages only via `showCountDots`
 *   (C) a subtle `AudioLines` icon hinting at voice notes / rhythm
 *
 * When you replace this with a real logo, the only file you need to touch
 * is this one — every consumer (navbar, auth pages) imports it.
 */
export function BrandLockup({
  size = "sm",
  showCountDots = false,
  href = "/",
  className,
}: Readonly<BrandLockupProps>) {
  const isLarge = size === "lg";

  return (
    <div className={cn("flex flex-col", showCountDots && "gap-2.5", className)}>
      <Link
        href={href}
        className={cn(
          "inline-flex w-fit shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isLarge ? "gap-3" : "gap-2"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex items-center justify-center bg-primary font-semibold tracking-tight text-primary-foreground",
            isLarge
              ? "size-9 rounded-lg text-base"
              : "size-7 rounded-md text-sm"
          )}
        >
          8
        </span>

        <span
          className={cn(
            "font-semibold tracking-tight",
            isLarge ? "text-lg" : "hidden text-sm sm:inline"
          )}
        >
          Eight Count
        </span>

        <AudioLines
          aria-hidden
          strokeWidth={2.25}
          className={cn(
            "text-primary",
            isLarge ? "size-4" : "hidden size-3.5 sm:inline-block"
          )}
        />
      </Link>

      {showCountDots ? (
        <div aria-hidden className="ml-12 flex items-center gap-1.5">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              key={i}
              className="inline-block size-1 rounded-full bg-primary/60"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

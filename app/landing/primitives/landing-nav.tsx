import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

import { BrandLockup } from "@/components/brand-lockup";

const ANCHOR_LINKS: { label: string; href: string }[] = [
  { label: "How it works", href: "#how-it-works" },
  { label: "For instructors", href: "#for-instructors" },
  { label: "For dancers", href: "#for-dancers" },
  { label: "Privacy", href: "/privacy" },
];

/**
 * Landing-page navigation bar. Replaces the global `<AppHeader />` on `/`
 * (the global header bails out when pathname === "/" — see
 * `components/app-header.tsx`). Anchor links scroll to in-page sections;
 * Privacy is an external page link.
 */
export function LandingNav() {
  return (
    <nav
      className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <BrandLockup size="sm" href="/" />

      {/* Anchor links — hidden below md to leave room for the CTAs */}
      <div
        className="hidden items-center gap-6 md:inline-flex"
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--muted-foreground)",
        }}
      >
        {ANCHOR_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="inline-flex items-center gap-2">
        <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center rounded-full font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{
              padding: "9px 14px",
              fontSize: 13,
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              background: "transparent",
            }}
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center rounded-full font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{
              padding: "9px 16px",
              fontSize: 13,
              background: "var(--foreground)",
              color: "var(--background)",
              border: "none",
            }}
          >
            Get started
          </button>
        </SignUpButton>
      </div>
    </nav>
  );
}

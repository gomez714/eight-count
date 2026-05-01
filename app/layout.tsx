import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eight Count",
  description: "Async rehearsal feedback for dance teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <header className="flex h-[60px] items-center justify-between gap-4 border-b bg-card px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <span
                aria-hidden
                className="inline-flex size-7 items-center justify-center rounded-md bg-foreground text-sm font-semibold tracking-tight text-background"
              >
                8
              </span>
              <span className="text-sm font-semibold tracking-tight">
                Eight Count
              </span>
            </Link>
            <Show when="signed-out">
              <div className="flex items-center gap-3">
                <SignInButton />
                <SignUpButton>
                  <button className="rounded-full bg-purple-700 px-4 py-2 text-sm font-medium text-white cursor-pointer">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
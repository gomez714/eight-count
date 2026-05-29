"use client";

import { UserButton } from "@clerk/nextjs";
import { Mail } from "lucide-react";

export function AppHeaderUserButton() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Email preferences"
          labelIcon={<Mail className="size-4" />}
          href="/settings/notifications"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

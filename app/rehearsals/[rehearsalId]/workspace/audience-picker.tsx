"use client";

import { useMemo } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

import type { AssignableMember, AvailableGroup } from "./types";

type AudiencePickerProps = {
  assignableMembers: AssignableMember[];
  availableGroups: AvailableGroup[];
  selectedGroupIds: string[];
  selectedAssigneeUserIds: string[];
  isFullCast: boolean;
  disabled?: boolean;
  onToggleFullCast: (next: boolean) => void;
  onToggleGroup: (groupId: string) => void;
  onToggleMember: (userId: string) => void;
};

export function AudiencePicker({
  assignableMembers,
  availableGroups,
  selectedGroupIds,
  selectedAssigneeUserIds,
  isFullCast,
  disabled = false,
  onToggleFullCast,
  onToggleGroup,
  onToggleMember,
}: AudiencePickerProps) {
  const fullCastCount = assignableMembers.length;

  const selectedSummary = useMemo(() => {
    if (isFullCast) {
      return [
        {
          id: "full-cast",
          label: "Full cast",
          tone: "primary" as const,
          onRemove: () => onToggleFullCast(false),
        },
      ];
    }

    const groupSummaries = selectedGroupIds
      .map((groupId) => {
        const group = availableGroups.find((g) => g.id === groupId);
        if (!group) return null;
        return {
          id: `group:${group.id}`,
          label: `${group.name} (${group.memberUserIds.length})`,
          tone: "secondary" as const,
          onRemove: () => onToggleGroup(group.id),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const memberSummaries = selectedAssigneeUserIds
      .map((userId) => {
        const member = assignableMembers.find((m) => m.id === userId);
        if (!member) return null;
        return {
          id: `user:${member.id}`,
          label: member.name || member.email,
          tone: "muted" as const,
          onRemove: () => onToggleMember(member.id),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return [...groupSummaries, ...memberSummaries];
  }, [
    isFullCast,
    selectedGroupIds,
    selectedAssigneeUserIds,
    availableGroups,
    assignableMembers,
    onToggleFullCast,
    onToggleGroup,
    onToggleMember,
  ]);

  return (
    <div className="space-y-2 rounded-md border">
      {selectedSummary.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b px-2 pt-2 pb-1.5">
          {selectedSummary.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                chip.tone === "primary" &&
                  "bg-foreground text-background hover:opacity-90",
                chip.tone === "secondary" &&
                  "border border-primary/20 bg-primary/10 text-primary",
                chip.tone === "muted" &&
                  "border border-border text-muted-foreground hover:bg-muted/50"
              )}
              aria-label={`Remove ${chip.label}`}
            >
              <span className="truncate">{chip.label}</span>
              <span aria-hidden className="opacity-70">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <Command shouldFilter={!isFullCast}>
        <CommandInput
          placeholder="Search people or groups..."
          disabled={disabled || isFullCast}
        />
        <CommandList className="max-h-56">
          {isFullCast ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Full cast selected. Remove the chip above to pick groups or
              individuals.
            </p>
          ) : (
            <>
              <CommandEmpty>No matches.</CommandEmpty>

              <CommandGroup heading="Quick">
                <CommandItem
                  value="full cast everyone all"
                  onSelect={() => onToggleFullCast(true)}
                  disabled={disabled || fullCastCount === 0}
                >
                  <span className="font-medium">Full cast</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {fullCastCount}
                  </span>
                </CommandItem>
              </CommandGroup>

              {availableGroups.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Groups">
                    {availableGroups.map((group) => {
                      const checked = selectedGroupIds.includes(group.id);
                      return (
                        <CommandItem
                          key={group.id}
                          value={`group ${group.name}`}
                          onSelect={() => onToggleGroup(group.id)}
                          disabled={disabled}
                          data-checked={checked || undefined}
                          className={cn(
                            checked &&
                              "bg-primary/10 text-primary aria-selected:bg-primary/15"
                          )}
                        >
                          <CheckIndicator checked={checked} />
                          <span>{group.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {group.memberUserIds.length}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              ) : null}

              <CommandSeparator />
              <CommandGroup heading="Members">
                {assignableMembers.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No team members available.
                  </div>
                ) : (
                  assignableMembers.map((member) => {
                    const checked = selectedAssigneeUserIds.includes(
                      member.id
                    );
                    const display = member.name || member.email;
                    return (
                      <CommandItem
                        key={member.id}
                        value={`${member.name ?? ""} ${member.email}`}
                        onSelect={() => onToggleMember(member.id)}
                        disabled={disabled}
                        data-checked={checked || undefined}
                        className={cn(checked && "font-medium")}
                      >
                        <CheckIndicator checked={checked} />
                        <span className="truncate">{display}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {member.role}
                        </span>
                      </CommandItem>
                    );
                  })
                )}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );
}

type CheckIndicatorProps = {
  checked: boolean;
};

function CheckIndicator({ checked }: CheckIndicatorProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background"
      )}
    >
      {checked ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          className="h-3 w-3"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.296a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414L8.5 12.086l6.79-6.79a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : null}
    </span>
  );
}

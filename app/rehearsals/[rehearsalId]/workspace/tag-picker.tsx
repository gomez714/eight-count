"use client";

import { Check, ChevronDown, Tag as TagIcon, X } from "lucide-react";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NOTE_TAGS,
  NOTE_TAG_DESCRIPTIONS,
  NOTE_TAG_LABELS,
  type NoteTag,
} from "@/lib/notes/tags";
import { cn } from "@/lib/utils";

type TagPickerProps = {
  value: NoteTag | null;
  onChange: (next: NoteTag | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
};

export function TagPicker({
  value,
  onChange,
  disabled = false,
  size = "sm",
}: TagPickerProps) {
  const [open, setOpen] = useState(false);

  const triggerHeight = size === "md" ? "h-8" : "h-7";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50",
            triggerHeight,
          )}
          aria-label={value ? `Tag: ${NOTE_TAG_LABELS[value]}` : "Add tag"}
        >
          <TagIcon className="size-3" />
          <span>{value ? NOTE_TAG_LABELS[value] : "Add tag"}</span>
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="flex flex-col">
          <p className="border-b px-3 py-2 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">
            Tag
          </p>
          <ul role="listbox" aria-label="Tags" className="flex flex-col py-1">
            {NOTE_TAGS.map((tag) => {
              const isActive = tag === value;
              return (
                <li key={tag}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(isActive ? null : tag);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      isActive && "bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {isActive ? <Check className="size-3" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {NOTE_TAG_LABELS[tag]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {NOTE_TAG_DESCRIPTIONS[tag]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="flex items-center gap-1.5 border-t px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <X className="size-3" />
              Clear tag
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

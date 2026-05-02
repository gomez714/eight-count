import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type NoteRehearsalLinkProps = {
  rehearsal: {
    id: string;
    title: string;
    project: { title: string };
  };
  className?: string;
};

export function NoteRehearsalLink({
  rehearsal,
  className,
}: Readonly<NoteRehearsalLinkProps>) {
  return (
    <Link
      href={`/rehearsals/${rehearsal.id}`}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded",
        className
      )}
    >
      <span className="font-medium text-muted-foreground">
        {rehearsal.project.title}
      </span>
      <ChevronRight aria-hidden className="size-3 opacity-60" />
      <span className="truncate">{rehearsal.title}</span>
    </Link>
  );
}

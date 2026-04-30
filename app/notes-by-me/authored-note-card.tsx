"use client";

import Link from "next/link";

import { AudienceChips } from "@/components/audience-chips";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isActiveStatus } from "@/lib/notes/statuses";
import { cn } from "@/lib/utils";

import type { AuthoredNoteRow } from "./types";

type AuthoredNoteCardProps = {
  row: AuthoredNoteRow;
};

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AuthoredNoteCard({ row }: AuthoredNoteCardProps) {
  const rehearsalDate = new Date(row.rehearsal.rehearsalDate);

  const totalAssignments = row.assignments.length;
  const addressedCount = row.assignments.filter(
    (assignment) => !isActiveStatus(assignment.status)
  ).length;
  const allAddressed =
    totalAssignments > 0 && addressedCount === totalAssignments;

  // Show audience intent (Full cast, groups) at the top.
  const audienceTargets = row.targets.filter(
    (target) => target.kind !== "USER"
  );

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">
              {row.rehearsal.project.team.name}
            </p>
            <CardTitle className="text-base">
              <Link
                href={`/rehearsals/${row.rehearsal.id}`}
                className="hover:underline"
              >
                {row.rehearsal.project.title}
                <span className="text-muted-foreground"> · </span>
                {row.rehearsal.title}
              </Link>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
              }).format(rehearsalDate)}
              {" · "}
              <span className="font-medium">
                {formatTimestamp(row.timestampMs)}
              </span>
            </p>
          </div>

          {totalAssignments > 0 ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                allAddressed
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground"
              )}
              data-progress={allAddressed ? "complete" : "in-progress"}
            >
              {addressedCount}/{totalAssignments} addressed
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
              Unassigned
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm whitespace-pre-wrap">{row.bodyText}</p>
        {audienceTargets.length > 0 ? (
          <AudienceChips targets={audienceTargets} />
        ) : null}
      </CardContent>
    </Card>
  );
}

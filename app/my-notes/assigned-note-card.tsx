"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateNoteAssignmentStatus } from "./note-status-actions";
import {
  NOTE_STATUSES,
  NOTE_STATUS_LABELS,
  type AssignedNoteRow,
  type NoteStatus,
} from "./types";

type AssignedNoteCardProps = {
  row: AssignedNoteRow;
};

function formatTimestamp(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AssignedNoteCard({ row }: AssignedNoteCardProps) {
  const [isPending, startTransition] = useTransition();

  const { note, status } = row;
  const rehearsalDate = new Date(note.rehearsal.rehearsalDate);

  const handleStatusChange = (nextStatus: string) => {
    if (nextStatus === status) {
      return;
    }

    startTransition(async () => {
      const result = await updateNoteAssignmentStatus({
        noteAssignmentId: row.id,
        status: nextStatus as NoteStatus,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Marked as ${NOTE_STATUS_LABELS[nextStatus as NoteStatus]}.`
      );
    });
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">
              {note.rehearsal.project.team.name}
            </p>
            <CardTitle className="text-base">
              <Link
                href={`/rehearsals/${note.rehearsal.id}`}
                className="hover:underline"
              >
                {note.rehearsal.project.title}
                <span className="text-muted-foreground"> · </span>
                {note.rehearsal.title}
              </Link>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
              }).format(rehearsalDate)}
              {" · "}
              <span className="font-medium">
                {formatTimestamp(note.timestampMs)}
              </span>
              {" · From "}
              {note.author.name || note.author.email}
            </p>
          </div>

          <Select
            value={status}
            onValueChange={handleStatusChange}
            disabled={isPending}
          >
            <SelectTrigger size="sm" aria-label="Update note status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {NOTE_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{note.bodyText}</p>
      </CardContent>
    </Card>
  );
}

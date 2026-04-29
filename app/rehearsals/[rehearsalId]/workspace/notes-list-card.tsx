"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type { NoteItem } from "./types"
import { formatTimestamp } from "./utils"

type NotesListCardProps = {
  notes: NoteItem[]
  onJumpToTimestamp: (timestampMs: number) => void
}

export function NotesListCard({ notes, onJumpToTimestamp }: NotesListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Timestamped feedback for this rehearsal video.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet. Add the first one above.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => onJumpToTimestamp(note.timestampMs)}
                className="flex w-full flex-col rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {formatTimestamp(note.timestampMs)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {note.author.name || note.author.email}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {note.bodyText}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

import { formatTimestamp } from "./utils"

type AddNoteCardProps = {
  selectedTimestampMs: number
  noteText: string
  onNoteTextChange: (value: string) => void
  noteError: string | null
  isPending: boolean
  disabled: boolean
  onCapture: () => void
  onSubmit: () => void
}

export function AddNoteCard({
  selectedTimestampMs,
  noteText,
  onNoteTextChange,
  noteError,
  isPending,
  disabled,
  onCapture,
  onSubmit,
}: AddNoteCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Add note</CardTitle>
        <CardDescription>
          Capture the current timestamp, then leave feedback tied to that
          moment.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex h-full flex-col gap-6">
        <FieldGroup className="flex flex-1 flex-col gap-4">
          <Field>
            <FieldLabel>Selected timestamp</FieldLabel>
            <FieldContent>
              <div className="text-sm font-medium">
                {formatTimestamp(selectedTimestampMs)}
              </div>
              <FieldDescription>
                Capturing a timestamp pauses the video automatically.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field className="flex flex-1 flex-col">
            <FieldLabel htmlFor="noteText">Note</FieldLabel>
            <FieldContent className="flex flex-1 flex-col">
              <Textarea
                id="noteText"
                value={noteText}
                onChange={(event) => onNoteTextChange(event.target.value)}
                placeholder="Timing is late entering this phrase"
                disabled={isPending}
                className="flex-1 resize-none md:min-h-[150px]"
              />
              <FieldDescription>
                Leave a clear correction or reminder for this exact moment.
              </FieldDescription>
              <FieldError
                errors={noteError ? [{ message: noteError }] : []}
              />
            </FieldContent>
          </Field>
        </FieldGroup>

        <div className="mt-auto flex flex-wrap gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCapture}
            disabled={disabled}
          >
            Capture current timestamp
          </Button>

          <Button type="button" onClick={onSubmit} disabled={disabled}>
            {isPending ? "Saving..." : "Add note"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

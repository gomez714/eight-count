-- CreateEnum
CREATE TYPE "NoteTargetKind" AS ENUM ('EVERYONE', 'GROUP', 'USER');

-- CreateTable
CREATE TABLE "NoteTarget" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "kind" "NoteTargetKind" NOT NULL,
    "userId" TEXT,
    "projectGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteTarget_noteId_idx" ON "NoteTarget"("noteId");

-- CreateIndex
CREATE INDEX "NoteTarget_userId_idx" ON "NoteTarget"("userId");

-- CreateIndex
CREATE INDEX "NoteTarget_projectGroupId_idx" ON "NoteTarget"("projectGroupId");

-- AddForeignKey
ALTER TABLE "NoteTarget" ADD CONSTRAINT "NoteTarget_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTarget" ADD CONSTRAINT "NoteTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing NoteAssignment rows become USER-kind NoteTarget rows so the
-- new display path is uniform without legacy fallbacks.
INSERT INTO "NoteTarget" ("id", "noteId", "kind", "userId", "createdAt")
SELECT
  'nt_' || "id",
  "noteId",
  'USER'::"NoteTargetKind",
  "userId",
  "createdAt"
FROM "NoteAssignment";

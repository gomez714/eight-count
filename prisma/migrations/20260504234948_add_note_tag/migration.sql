-- CreateEnum
CREATE TYPE "NoteTag" AS ENUM ('TIMING', 'SPACING', 'ENERGY', 'MUSICALITY', 'FORMATION', 'TECHNIQUE');

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "tag" "NoteTag";

-- CreateIndex
CREATE INDEX "Note_tag_idx" ON "Note"("tag");

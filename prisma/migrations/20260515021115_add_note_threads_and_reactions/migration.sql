-- CreateEnum
CREATE TYPE "ReactionKind" AS ENUM ('ACKNOWLEDGE', 'QUESTION', 'ENCOURAGE');

-- CreateTable
CREATE TABLE "NoteComment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteReaction" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteThreadView" (
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteThreadView_pkey" PRIMARY KEY ("noteId","userId")
);

-- CreateIndex
CREATE INDEX "NoteComment_noteId_createdAt_idx" ON "NoteComment"("noteId", "createdAt");

-- CreateIndex
CREATE INDEX "NoteComment_authorId_idx" ON "NoteComment"("authorId");

-- CreateIndex
CREATE INDEX "NoteReaction_noteId_idx" ON "NoteReaction"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteReaction_noteId_userId_kind_key" ON "NoteReaction"("noteId", "userId", "kind");

-- CreateIndex
CREATE INDEX "NoteThreadView_userId_idx" ON "NoteThreadView"("userId");

-- AddForeignKey
ALTER TABLE "NoteComment" ADD CONSTRAINT "NoteComment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteComment" ADD CONSTRAINT "NoteComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteReaction" ADD CONSTRAINT "NoteReaction_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteReaction" ADD CONSTRAINT "NoteReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteThreadView" ADD CONSTRAINT "NoteThreadView_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteThreadView" ADD CONSTRAINT "NoteThreadView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

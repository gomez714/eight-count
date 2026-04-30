-- CreateTable
CREATE TABLE "ProjectGroup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGroupMember" (
    "id" TEXT NOT NULL,
    "projectGroupId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectGroup_projectId_idx" ON "ProjectGroup"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGroup_projectId_name_key" ON "ProjectGroup"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectGroupMember_projectGroupId_idx" ON "ProjectGroupMember"("projectGroupId");

-- CreateIndex
CREATE INDEX "ProjectGroupMember_teamMemberId_idx" ON "ProjectGroupMember"("teamMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGroupMember_projectGroupId_teamMemberId_key" ON "ProjectGroupMember"("projectGroupId", "teamMemberId");

-- AddForeignKey
ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroupMember" ADD CONSTRAINT "ProjectGroupMember_projectGroupId_fkey" FOREIGN KEY ("projectGroupId") REFERENCES "ProjectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroupMember" ADD CONSTRAINT "ProjectGroupMember_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTarget" ADD CONSTRAINT "NoteTarget_projectGroupId_fkey" FOREIGN KEY ("projectGroupId") REFERENCES "ProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

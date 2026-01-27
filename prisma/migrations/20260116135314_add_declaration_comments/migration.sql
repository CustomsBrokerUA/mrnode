-- CreateTable
CREATE TABLE "DeclarationComment" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeclarationComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeclarationComment_declarationId_idx" ON "DeclarationComment"("declarationId");

-- CreateIndex
CREATE INDEX "DeclarationComment_createdAt_idx" ON "DeclarationComment"("createdAt");

-- AddForeignKey
ALTER TABLE "DeclarationComment" ADD CONSTRAINT "DeclarationComment_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "DeclarationSummary" ADD COLUMN     "contractHolder" TEXT;

-- CreateTable
CREATE TABLE "DeclarationHsCode" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "hsCode" TEXT NOT NULL,

    CONSTRAINT "DeclarationHsCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeclarationHsCode_declarationId_idx" ON "DeclarationHsCode"("declarationId");

-- CreateIndex
CREATE INDEX "DeclarationHsCode_hsCode_idx" ON "DeclarationHsCode"("hsCode");

-- CreateIndex
CREATE UNIQUE INDEX "DeclarationHsCode_declarationId_hsCode_key" ON "DeclarationHsCode"("declarationId", "hsCode");

-- AddForeignKey
ALTER TABLE "DeclarationHsCode" ADD CONSTRAINT "DeclarationHsCode_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

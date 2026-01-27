-- CreateTable
CREATE TABLE "DeclarationSummary" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "customsValue" DOUBLE PRECISION,
    "currency" TEXT,
    "totalItems" INTEGER,
    "customsOffice" TEXT,
    "declarantName" TEXT,
    "senderName" TEXT,
    "recipientName" TEXT,
    "declarationType" TEXT,
    "registeredDate" TIMESTAMP(3),
    "invoiceValue" DOUBLE PRECISION,
    "invoiceCurrency" TEXT,
    "invoiceValueUah" DOUBLE PRECISION,
    "exchangeRate" DOUBLE PRECISION,
    "transportDetails" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeclarationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeclarationSummary_declarationId_key" ON "DeclarationSummary"("declarationId");

-- AddForeignKey
ALTER TABLE "DeclarationSummary" ADD CONSTRAINT "DeclarationSummary_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

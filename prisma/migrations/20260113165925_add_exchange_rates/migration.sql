-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "currencyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_date_idx" ON "ExchangeRate"("date");

-- CreateIndex
CREATE INDEX "ExchangeRate_currencyCode_idx" ON "ExchangeRate"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_currencyCode_key" ON "ExchangeRate"("date", "currencyCode");

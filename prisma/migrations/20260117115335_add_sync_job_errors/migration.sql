-- CreateTable
CREATE TABLE "SyncJobError" (
    "id" TEXT NOT NULL,
    "syncJobId" TEXT NOT NULL,
    "chunkNumber" INTEGER NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorCode" TEXT,
    "retryAttempts" INTEGER NOT NULL DEFAULT 0,
    "isRetried" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJobError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncJobError_syncJobId_idx" ON "SyncJobError"("syncJobId");

-- CreateIndex
CREATE INDEX "SyncJobError_chunkNumber_idx" ON "SyncJobError"("chunkNumber");

-- AddForeignKey
ALTER TABLE "SyncJobError" ADD CONSTRAINT "SyncJobError_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

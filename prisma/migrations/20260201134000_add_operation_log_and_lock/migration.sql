-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "details" TEXT,
    "meta" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationLock" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "companyId" TEXT,
    "userId" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationLog_companyId_idx" ON "OperationLog"("companyId");

-- CreateIndex
CREATE INDEX "OperationLog_userId_idx" ON "OperationLog"("userId");

-- CreateIndex
CREATE INDEX "OperationLog_operation_idx" ON "OperationLog"("operation");

-- CreateIndex
CREATE INDEX "OperationLog_status_idx" ON "OperationLog"("status");

-- CreateIndex
CREATE INDEX "OperationLog_createdAt_idx" ON "OperationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationLock_scopeKey_key" ON "OperationLock"("scopeKey");

-- CreateIndex
CREATE INDEX "OperationLock_companyId_idx" ON "OperationLock"("companyId");

-- CreateIndex
CREATE INDEX "OperationLock_userId_idx" ON "OperationLock"("userId");

-- CreateIndex
CREATE INDEX "OperationLock_operation_idx" ON "OperationLock"("operation");

-- CreateIndex
CREATE INDEX "OperationLock_expiresAt_idx" ON "OperationLock"("expiresAt");

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLog" ADD CONSTRAINT "OperationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLock" ADD CONSTRAINT "OperationLock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationLock" ADD CONSTRAINT "OperationLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

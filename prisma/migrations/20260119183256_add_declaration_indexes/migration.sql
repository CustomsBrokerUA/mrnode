-- CreateIndex
CREATE INDEX "Declaration_companyId_idx" ON "Declaration"("companyId");

-- CreateIndex
CREATE INDEX "Declaration_companyId_status_idx" ON "Declaration"("companyId", "status");

-- CreateIndex
CREATE INDEX "Declaration_companyId_date_idx" ON "Declaration"("companyId", "date");

-- CreateIndex
CREATE INDEX "Declaration_customsId_idx" ON "Declaration"("customsId");

-- CreateIndex
CREATE INDEX "Declaration_mrn_idx" ON "Declaration"("mrn");

-- CreateIndex
CREATE INDEX "Declaration_status_idx" ON "Declaration"("status");

-- CreateIndex
CREATE INDEX "Declaration_date_idx" ON "Declaration"("date");

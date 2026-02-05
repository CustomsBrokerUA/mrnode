-- Add denormalized fields used by archive filters (representative/carrier/bank)

ALTER TABLE "DeclarationSummary"
  ADD COLUMN IF NOT EXISTS "representativeName" TEXT,
  ADD COLUMN IF NOT EXISTS "carrierName" TEXT,
  ADD COLUMN IF NOT EXISTS "bankName" TEXT;

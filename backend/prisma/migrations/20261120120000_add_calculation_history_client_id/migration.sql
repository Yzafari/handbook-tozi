-- Idempotency key for calculation history records created offline.
-- Postgres allows multiple NULLs in a unique index, so rows without a
-- clientId keep the previous behaviour.
ALTER TABLE "CalculationHistory" ADD COLUMN "clientId" TEXT;

CREATE UNIQUE INDEX "CalculationHistory_userId_clientId_key"
  ON "CalculationHistory"("userId", "clientId");

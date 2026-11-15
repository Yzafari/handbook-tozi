-- Backward-compatible additions for the existing Prisma schema.
-- Existing columns and records are retained; new application fields are added.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "phoneEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "amountToman" INTEGER,
  ADD COLUMN IF NOT EXISTS "durationDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "cardPanMasked" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

-- Historical `amount` units are not reliably established by the old schema/code.
-- Do not backfill `amountToman` from it; legacy values remain explicitly unknown.

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Subscription_userId_status_endDate_idx" ON "Subscription"("userId", "status", "endDate");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- The original initial migration did not create Notification even though the
-- application schema and services already referenced it.
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

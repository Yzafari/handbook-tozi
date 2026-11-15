CREATE TABLE "OcrJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageDeleted" BOOLEAN NOT NULL DEFAULT false,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "resultText" TEXT,
  "confidence" DOUBLE PRECISION,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OcrJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OcrJob_storageKey_key" ON "OcrJob"("storageKey");
CREATE INDEX "OcrJob_userId_createdAt_idx" ON "OcrJob"("userId", "createdAt");
CREATE INDEX "OcrJob_status_availableAt_createdAt_idx" ON "OcrJob"("status", "availableAt", "createdAt");
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

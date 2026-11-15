CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'ROLE_RESTRICTED', 'PRIVATE');

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PUBLIC',
  "accessRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ownerId" TEXT,
  "description" TEXT,
  "pageCount" INTEGER,
  "language" TEXT NOT NULL DEFAULT 'fa',
  "indexStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "indexedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Document_checksumSha256_key" ON "Document"("checksumSha256");
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE INDEX "Document_visibility_isActive_createdAt_idx" ON "Document"("visibility", "isActive", "createdAt");
CREATE INDEX "Document_ownerId_createdAt_idx" ON "Document"("ownerId", "createdAt");
CREATE INDEX "Document_indexStatus_updatedAt_idx" ON "Document"("indexStatus", "updatedAt");
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DocumentIndexJob" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentIndexJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentIndexJob_status_availableAt_createdAt_idx" ON "DocumentIndexJob"("status", "availableAt", "createdAt");
CREATE INDEX "DocumentIndexJob_documentId_createdAt_idx" ON "DocumentIndexJob"("documentId", "createdAt");
ALTER TABLE "DocumentIndexJob" ADD CONSTRAINT "DocumentIndexJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

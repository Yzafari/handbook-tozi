CREATE TABLE "SyncRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleName" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyncRecord_userId_moduleName_entityType_entityId_key" ON "SyncRecord"("userId", "moduleName", "entityType", "entityId");
CREATE INDEX "SyncRecord_userId_updatedAt_id_idx" ON "SyncRecord"("userId", "updatedAt", "id");
ALTER TABLE "SyncRecord" ADD CONSTRAINT "SyncRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SyncOperation" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleName" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "resultStatus" TEXT NOT NULL,
  "resultVersion" INTEGER,
  "conflictReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyncOperation_operationId_key" ON "SyncOperation"("operationId");
CREATE INDEX "SyncOperation_userId_createdAt_idx" ON "SyncOperation"("userId", "createdAt");
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

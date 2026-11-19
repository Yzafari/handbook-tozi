-- CreateTable
CREATE TABLE "CalculationHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "toolVersion" TEXT NOT NULL,
    "inputData" JSONB NOT NULL,
    "outputData" JSONB NOT NULL,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalculationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalculationHistory_userId_createdAt_idx" ON "CalculationHistory"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CalculationHistory" ADD CONSTRAINT "CalculationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

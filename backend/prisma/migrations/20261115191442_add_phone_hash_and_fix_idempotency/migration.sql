/*
  Warnings:

  - A unique constraint covering the columns `[userId,idempotencyKey]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phoneHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Payment_idempotencyKey_key";

-- DropIndex
DROP INDEX "User_jobRole_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_userId_idempotencyKey_key" ON "Payment"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneHash_key" ON "User"("phoneHash");

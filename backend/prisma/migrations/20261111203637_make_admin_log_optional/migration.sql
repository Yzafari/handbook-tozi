-- DropForeignKey
ALTER TABLE "AdminLog" DROP CONSTRAINT "AdminLog_adminId_fkey";

-- AlterTable
ALTER TABLE "AdminLog" ALTER COLUMN "adminId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

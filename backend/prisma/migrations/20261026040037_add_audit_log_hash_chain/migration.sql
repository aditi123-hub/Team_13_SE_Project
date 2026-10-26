-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "recordHash" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

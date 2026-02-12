-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'CANCELLED';

-- CreateIndex
CREATE INDEX "Job_orgId_completedAt_id_idx" ON "Job"("orgId", "completedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Job_orgId_status_createdAt_id_idx" ON "Job"("orgId", "status", "createdAt" DESC, "id" DESC);

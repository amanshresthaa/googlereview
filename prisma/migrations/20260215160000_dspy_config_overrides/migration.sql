ALTER TABLE "OrgSettings"
  ADD COLUMN "dspyConfigJson" JSONB;

ALTER TABLE "Location"
  ADD COLUMN "dspyConfigJson" JSONB;

ALTER TABLE "DspyRun"
  ADD COLUMN "experimentId" TEXT,
  ADD COLUMN "executionConfigJson" JSONB;

CREATE INDEX "DspyRun_orgId_experimentId_createdAt_idx"
  ON "DspyRun"("orgId", "experimentId", "createdAt" DESC);

CREATE INDEX "DspyRun_orgId_reviewId_experimentId_inputHash_idx"
  ON "DspyRun"("orgId", "reviewId", "experimentId", "inputHash");

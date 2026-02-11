-- Normalize payloads before contracting job type enum.
UPDATE "Job"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'reviewId', "payload"->>'reviewId',
    'mode', CASE
      WHEN COALESCE("payload"->>'requestedBy', 'AUTO') = 'MANUAL' THEN 'MANUAL_REGENERATE'
      ELSE 'AUTO'
    END,
    'budgetOverride', COALESCE("payload"->'budgetOverride', jsonb_build_object('enabled', false))
  )
)
WHERE "type" = 'GENERATE_DRAFT';

UPDATE "Job" AS j
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'reviewId', COALESCE(dr."reviewId", j."payload"->>'reviewId'),
    'mode', 'VERIFY_EXISTING_DRAFT',
    'draftReplyId', j."payload"->>'draftReplyId',
    'budgetOverride', COALESCE(j."payload"->'budgetOverride', jsonb_build_object('enabled', false))
  )
)
FROM "DraftReply" AS dr
WHERE j."type" = 'VERIFY_DRAFT'
  AND dr."id" = j."payload"->>'draftReplyId';

UPDATE "Job"
SET "payload" = jsonb_strip_nulls(
  jsonb_build_object(
    'reviewId', "payload"->>'reviewId',
    'mode', 'VERIFY_EXISTING_DRAFT',
    'draftReplyId', "payload"->>'draftReplyId',
    'budgetOverride', COALESCE("payload"->'budgetOverride', jsonb_build_object('enabled', false))
  )
)
WHERE "type" = 'VERIFY_DRAFT'
  AND NOT EXISTS (
    SELECT 1
    FROM "DraftReply" AS dr
    WHERE dr."id" = "Job"."payload"->>'draftReplyId'
  );

ALTER TYPE "JobType" RENAME TO "JobType_old";
CREATE TYPE "JobType" AS ENUM ('SYNC_LOCATIONS', 'SYNC_REVIEWS', 'PROCESS_REVIEW', 'POST_REPLY');
ALTER TABLE "Job"
  ALTER COLUMN "type" TYPE "JobType"
  USING (
    CASE
      WHEN "type"::text IN ('GENERATE_DRAFT', 'VERIFY_DRAFT') THEN 'PROCESS_REVIEW'
      ELSE "type"::text
    END
  )::"JobType";
DROP TYPE "JobType_old";

CREATE TYPE "DspyRunMode" AS ENUM ('AUTO', 'MANUAL_REGENERATE', 'VERIFY_EXISTING_DRAFT');
CREATE TYPE "DspyRunStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "DspyRun" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "draftReplyId" TEXT,
  "mode" "DspyRunMode" NOT NULL,
  "status" "DspyRunStatus" NOT NULL,
  "decision" "DraftStatus",
  "draftModel" TEXT NOT NULL,
  "verifyModel" TEXT NOT NULL,
  "draftTraceId" TEXT,
  "verifyTraceId" TEXT,
  "requestId" TEXT,
  "attemptCount" INTEGER NOT NULL,
  "latencyMs" INTEGER,
  "inputHash" TEXT NOT NULL,
  "outputJson" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DspyRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DspyRun"
  ADD CONSTRAINT "DspyRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DspyRun"
  ADD CONSTRAINT "DspyRun_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DspyRun"
  ADD CONSTRAINT "DspyRun_draftReplyId_fkey" FOREIGN KEY ("draftReplyId") REFERENCES "DraftReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DspyRun_orgId_createdAt_idx" ON "DspyRun"("orgId", "createdAt" DESC);
CREATE INDEX "DspyRun_reviewId_createdAt_idx" ON "DspyRun"("reviewId", "createdAt" DESC);
CREATE INDEX "DspyRun_draftReplyId_idx" ON "DspyRun"("draftReplyId");

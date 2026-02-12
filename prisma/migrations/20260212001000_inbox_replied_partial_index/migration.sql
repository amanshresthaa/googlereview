-- Improve replied-tab inbox pagination by constraining to replied rows
-- while preserving org-scoped createTime/id ordering.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Review_orgId_replied_partial_idx'
  ) THEN
    CREATE INDEX "Review_orgId_replied_partial_idx"
      ON "Review"("orgId", "createTime" DESC, "id" DESC)
      WHERE "googleReplyComment" IS NOT NULL;
  END IF;
END;
$$;

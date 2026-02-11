CREATE INDEX "Review_orgId_createTime_id_idx"
  ON "Review"("orgId", "createTime" DESC, "id" DESC);

CREATE INDEX "Review_orgId_starRating_createTime_id_idx"
  ON "Review"("orgId", "starRating", "createTime" DESC, "id" DESC);

CREATE INDEX "Review_orgId_createTime_id_unanswered_idx"
  ON "Review"("orgId", "createTime" DESC, "id" DESC)
  WHERE "googleReplyComment" IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Review_reviewerDisplayName_trgm_idx"
  ON "Review"
  USING GIN ("reviewerDisplayName" gin_trgm_ops);

CREATE INDEX "Review_comment_trgm_idx"
  ON "Review"
  USING GIN ("comment" gin_trgm_ops);

CREATE INDEX "Location_displayName_trgm_idx"
  ON "Location"
  USING GIN ("displayName" gin_trgm_ops);

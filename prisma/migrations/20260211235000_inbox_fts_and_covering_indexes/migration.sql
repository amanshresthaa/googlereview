-- 1. Full-text search vector column, GIN index, trigger, and backfill

ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

CREATE INDEX IF NOT EXISTS "Review_search_vector_gin_idx"
  ON "Review" USING GIN ("search_vector");

CREATE OR REPLACE FUNCTION review_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."reviewerDisplayName", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."comment", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'review_search_vector_trigger'
  ) THEN
    CREATE TRIGGER review_search_vector_trigger
      BEFORE INSERT OR UPDATE OF "comment", "reviewerDisplayName"
      ON "Review"
      FOR EACH ROW
      EXECUTE FUNCTION review_search_vector_update();
  END IF;
END;
$$;

UPDATE "Review"
SET "search_vector" =
  setweight(to_tsvector('english', coalesce("reviewerDisplayName", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("comment", '')), 'B')
WHERE "search_vector" IS NULL;

-- 2. Covering index for the counts query

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Review_orgId_locationId_counts_covering_idx'
  ) THEN
    CREATE INDEX "Review_orgId_locationId_counts_covering_idx"
      ON "Review"("orgId", "locationId")
      INCLUDE ("googleReplyComment", "starRating", "mentions");
  END IF;
END;
$$;

-- 3. Partial index for urgent reviews (unanswered + low rating)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Review_orgId_urgent_partial_idx'
  ) THEN
    CREATE INDEX "Review_orgId_urgent_partial_idx"
      ON "Review"("orgId", "createTime" DESC, "id" DESC)
      WHERE "googleReplyComment" IS NULL AND "starRating" <= 2;
  END IF;
END;
$$;

-- 4. GIN index on mentions array

CREATE INDEX IF NOT EXISTS "Review_mentions_gin_idx"
  ON "Review" USING GIN ("mentions");

-- 5. Partial index for 5-star reviews

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Review_orgId_five_star_partial_idx'
  ) THEN
    CREATE INDEX "Review_orgId_five_star_partial_idx"
      ON "Review"("orgId", "createTime" DESC, "id" DESC)
      WHERE "starRating" = 5;
  END IF;
END;
$$;

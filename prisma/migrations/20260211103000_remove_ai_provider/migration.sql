-- Normalize historical provider values before schema contraction.
UPDATE "OrgSettings"
SET "aiProvider" = 'OPENAI'
WHERE "aiProvider" = 'GEMINI';

ALTER TABLE "OrgSettings"
DROP COLUMN "aiProvider";

DROP TYPE "AiProvider";

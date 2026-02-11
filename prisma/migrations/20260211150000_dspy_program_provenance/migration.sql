ALTER TABLE "DspyRun"
  ADD COLUMN "programVersion" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "draftArtifactVersion" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "verifyArtifactVersion" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "DspyRun_programVersion_createdAt_idx" ON "DspyRun"("programVersion", "createdAt" DESC);
CREATE INDEX "DspyRun_mode_createdAt_idx" ON "DspyRun"("mode", "createdAt" DESC);

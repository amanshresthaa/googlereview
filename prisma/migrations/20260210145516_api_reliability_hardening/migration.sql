-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "dedupKey" TEXT,
ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "triggeredByRequestId" TEXT,
ADD COLUMN     "triggeredByUserId" TEXT;

-- CreateTable
CREATE TABLE "ApiIdempotencyKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBodyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRateLimitWindow" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "windowStartUtcMinute" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRateLimitWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiBudgetDaily" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "dayIso" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiBudgetDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCooldown" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCircuitBreaker" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "upstreamKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "openUntil" TIMESTAMP(3),
    "windowStartUtc" TIMESTAMP(3),
    "windowFailures" INTEGER NOT NULL DEFAULT 0,
    "halfOpenSuccesses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCircuitBreaker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiIdempotencyKey_expiresAt_idx" ON "ApiIdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiIdempotencyKey_orgId_userId_createdAt_idx" ON "ApiIdempotencyKey"("orgId", "userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiIdempotencyKey_orgId_userId_method_path_key_key" ON "ApiIdempotencyKey"("orgId", "userId", "method", "path", "key");

-- CreateIndex
CREATE INDEX "ApiRateLimitWindow_windowStartUtcMinute_idx" ON "ApiRateLimitWindow"("windowStartUtcMinute");

-- CreateIndex
CREATE INDEX "ApiRateLimitWindow_orgId_scope_windowStartUtcMinute_idx" ON "ApiRateLimitWindow"("orgId", "scope", "windowStartUtcMinute");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRateLimitWindow_orgId_userId_scope_windowStartUtcMinute_key" ON "ApiRateLimitWindow"("orgId", "userId", "scope", "windowStartUtcMinute");

-- CreateIndex
CREATE INDEX "ApiBudgetDaily_orgId_scope_dayIso_idx" ON "ApiBudgetDaily"("orgId", "scope", "dayIso");

-- CreateIndex
CREATE UNIQUE INDEX "ApiBudgetDaily_orgId_scope_dayIso_key" ON "ApiBudgetDaily"("orgId", "scope", "dayIso");

-- CreateIndex
CREATE INDEX "ApiCooldown_availableAt_idx" ON "ApiCooldown"("availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCooldown_orgId_scope_key_key" ON "ApiCooldown"("orgId", "scope", "key");

-- CreateIndex
CREATE INDEX "ApiCircuitBreaker_orgId_state_idx" ON "ApiCircuitBreaker"("orgId", "state");

-- CreateIndex
CREATE INDEX "ApiCircuitBreaker_openUntil_idx" ON "ApiCircuitBreaker"("openUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCircuitBreaker_orgId_upstreamKey_key" ON "ApiCircuitBreaker"("orgId", "upstreamKey");

-- CreateIndex
CREATE INDEX "Job_orgId_type_dedupKey_idx" ON "Job"("orgId", "type", "dedupKey");

-- In-flight job de-duplication (partial unique index).
-- Ensures at most one job is in-flight per (orgId, type, dedupKey) across all instances.
CREATE UNIQUE INDEX "Job_orgId_type_dedupKey_inflight_uniq"
ON "Job" ("orgId", "type", "dedupKey")
WHERE "dedupKey" IS NOT NULL
  AND "status" IN ('PENDING','RUNNING','RETRYING');

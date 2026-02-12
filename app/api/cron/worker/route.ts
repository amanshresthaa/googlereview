import crypto from "node:crypto"
import { env } from "@/lib/env"
import { runWorkerOnce } from "@/lib/jobs/worker"
import { scheduleReviewSyncJobs } from "@/lib/jobs/scheduler"
import { newRequestId } from "@/lib/api/json"
import { okJson, errJson } from "@/lib/api/response"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

async function handle(req: Request) {
  const requestId = newRequestId()
  // When deploying a beta build against a shared production database, we must
  // prevent double-processing by ensuring only one deployment runs the worker.
  if (process.env.DISABLE_CRON === "true") {
    return okJson({ requestId, body: { disabled: true } })
  }

  const e = env()
  const auth = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${e.CRON_SECRET}`
  if (auth !== expected) {
    return errJson({ requestId, status: 401, code: "UNAUTHORIZED", message: "Unauthorized." })
  }

  // Lightweight cleanup first. Failures must not block job processing.
  try {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60_000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60_000)
    await prisma.apiIdempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } })
    await prisma.apiRateLimitWindow.deleteMany({ where: { windowStartUtcMinute: { lt: twoHoursAgo } } })
    await prisma.apiCooldown.deleteMany({ where: { availableAt: { lt: now } } })
    // Keep circuit breaker rows, but prune long-expired OPEN states to reduce clutter.
    await prisma.apiCircuitBreaker.deleteMany({
      where: {
        state: "OPEN",
        openUntil: { lt: twoHoursAgo },
      },
    })
    // Retain only ~30 days of terminal job history to keep the jobs table bounded.
    await prisma.job.deleteMany({
      where: {
        status: { in: ["COMPLETED", "FAILED", "CANCELLED"] },
        completedAt: { lt: thirtyDaysAgo },
      },
    })
  } catch {
    // Intentionally swallow cleanup errors.
  }

  const scheduler = await scheduleReviewSyncJobs({
    minStalenessMs: 5 * 60_000,
    limit: 50,
  })

  const workerId = crypto.randomUUID()
  const run = await runWorkerOnce({ limit: 10, workerId })

  return okJson({ requestId, body: { scheduled: scheduler, worker: run } })
}

// Vercel Cron Jobs invoke endpoints using GET requests.
export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}

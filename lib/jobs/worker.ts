import { prisma } from "@/lib/db"
import { claimJobs, claimJobsForOrg, completeJob, markJobFailed, retryJob } from "@/lib/jobs/queue"
import { handleJob } from "@/lib/jobs/handlers"
import { NonRetryableError, RetryableJobError } from "@/lib/jobs/errors"
import type { JobType } from "@prisma/client"

export async function runWorkerOnce(input: { limit: number; workerId: string }) {
  const claimed = await claimJobs({ limit: input.limit, workerId: input.workerId })
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const job of claimed) {
    try {
      await handleJob(job)
      await completeJob(job.id)
      results.push({ id: job.id, ok: true })
    } catch (err) {
      if (err instanceof NonRetryableError) {
        await markJobFailed(job.id, err)
        results.push({ id: job.id, ok: false, error: err.code })
        continue
      }
      if (err instanceof RetryableJobError) {
        const attempts = job.attempts ?? 0
        const maxAttempts = job.maxAttempts ?? 10
        if (attempts + 1 >= maxAttempts) {
          await markJobFailed(job.id, err)
        } else {
          await retryJob(job.id, attempts, maxAttempts, err)
        }
        results.push({ id: job.id, ok: false, error: err.code })
        continue
      }
      const attempts = job.attempts ?? 0
      const maxAttempts = job.maxAttempts ?? 10
      if (attempts + 1 >= maxAttempts) {
        await markJobFailed(job.id, err)
      } else {
        await retryJob(job.id, attempts, maxAttempts, err)
      }
      results.push({ id: job.id, ok: false, error: "INTERNAL" })
    }
  }

  return { claimed: claimed.length, results }
}

export async function runWorkerOnceForOrg(input: { orgId: string; limit: number; workerId: string }) {
  const claimed = await claimJobsForOrg({ orgId: input.orgId, limit: input.limit, workerId: input.workerId })
  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const job of claimed) {
    try {
      await handleJob(job)
      await completeJob(job.id)
      results.push({ id: job.id, ok: true })
    } catch (err) {
      if (err instanceof NonRetryableError) {
        await markJobFailed(job.id, err)
        results.push({ id: job.id, ok: false, error: err.code })
        continue
      }
      if (err instanceof RetryableJobError) {
        const attempts = job.attempts ?? 0
        const maxAttempts = job.maxAttempts ?? 10
        if (attempts + 1 >= maxAttempts) {
          await markJobFailed(job.id, err)
        } else {
          await retryJob(job.id, attempts, maxAttempts, err)
        }
        results.push({ id: job.id, ok: false, error: err.code })
        continue
      }
      const attempts = job.attempts ?? 0
      const maxAttempts = job.maxAttempts ?? 10
      if (attempts + 1 >= maxAttempts) {
        await markJobFailed(job.id, err)
      } else {
        await retryJob(job.id, attempts, maxAttempts, err)
      }
      results.push({ id: job.id, ok: false, error: "INTERNAL" })
    }
  }

  return { claimed: claimed.length, results }
}

export async function runProcessReviewFastPath(input: {
  jobId: string
  orgId: string
  workerId: string
  budgetMs: number
}) {
  return runSingleJobFastPath({
    jobId: input.jobId,
    orgId: input.orgId,
    workerId: input.workerId,
    budgetMs: input.budgetMs,
    type: "PROCESS_REVIEW",
  })
}

export async function runPostReplyFastPath(input: {
  jobId: string
  orgId: string
  workerId: string
  budgetMs: number
}) {
  return runSingleJobFastPath({
    jobId: input.jobId,
    orgId: input.orgId,
    workerId: input.workerId,
    budgetMs: input.budgetMs,
    type: "POST_REPLY",
  })
}

async function runSingleJobFastPath(input: {
  jobId: string
  orgId: string
  workerId: string
  budgetMs: number
  type: JobType
}) {
  // Fast-path for one explicit job type. Must never drain arbitrary jobs.
  // If we can't claim the job immediately, we return without side effects.
  const now = new Date()
  const claimed = await prisma.job.updateMany({
    where: {
      id: input.jobId,
      orgId: input.orgId,
      type: input.type,
      status: { in: ["PENDING", "RETRYING"] },
      lockedAt: null,
    },
    data: {
      status: "RUNNING",
      lockedAt: now,
      lockedBy: input.workerId,
    },
  })

  if (claimed.count !== 1) return { claimed: 0, results: [] as Array<{ id: string; ok: boolean; error?: string }> }

  const job = await prisma.job.findUnique({ where: { id: input.jobId } })
  if (!job) {
    return { claimed: 1, results: [{ id: input.jobId, ok: false, error: "INTERNAL" }] }
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = []
  const abort = new AbortController()
  const t = setTimeout(() => abort.abort(), Math.max(0, input.budgetMs))

  try {
    await handleJob(job, { signal: abort.signal })
    await completeJob(job.id)
    results.push({ id: job.id, ok: true })
  } catch (err) {
    // Fast-path is a best-effort UX optimization. If we exhaust the local budget,
    // avoid mutating attempts/backoff: release the lock and let the canonical worker
    // (cron) execute later. This prevents user-initiated fast-path from creating
    // noisy RETRYING backlogs and consuming attempts.
    if (abort.signal.aborted) {
      if ((job.maxAttempts ?? 10) <= 1) {
        await markJobFailed(
          job.id,
          new NonRetryableError("FASTPATH_TIMEOUT", "Fast-path execution budget exhausted."),
        )
        results.push({ id: job.id, ok: false, error: "FASTPATH_TIMEOUT" })
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "RETRYING", lockedAt: null, lockedBy: null, runAt: new Date() },
        })
        results.push({ id: job.id, ok: false, error: "FASTPATH_BUDGET_EXHAUSTED" })
      }
      return { claimed: 1, results }
    }

    if (err instanceof NonRetryableError) {
      await markJobFailed(job.id, err)
      results.push({ id: job.id, ok: false, error: err.code })
    } else if (err instanceof RetryableJobError) {
      const attempts = job.attempts ?? 0
      const maxAttempts = job.maxAttempts ?? 10
      if (attempts + 1 >= maxAttempts) {
        await markJobFailed(job.id, err)
      } else {
        await retryJob(job.id, attempts, maxAttempts, err)
      }
      results.push({ id: job.id, ok: false, error: err.code })
    } else {
      const attempts = job.attempts ?? 0
      const maxAttempts = job.maxAttempts ?? 10
      if (attempts + 1 >= maxAttempts) {
        await markJobFailed(job.id, err)
      } else {
        await retryJob(job.id, attempts, maxAttempts, err)
      }
      results.push({ id: job.id, ok: false, error: "INTERNAL" })
    }
  } finally {
    clearTimeout(t)
  }

  return { claimed: 1, results }
}

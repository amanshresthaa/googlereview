import { prisma } from "@/lib/db"
import { claimJobs, completeJob, markJobFailed, retryJob } from "@/lib/jobs/queue"
import { handleJob } from "@/lib/jobs/handlers"
import { NonRetryableError, RetryableJobError } from "@/lib/jobs/errors"

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

export async function runVerifyFastPath(input: {
  jobId: string
  orgId: string
  workerId: string
  budgetMs: number
}) {
  // Only for VERIFY_DRAFT jobs. Must never drain arbitrary jobs.
  // If we can't claim the job immediately, we return without side effects.
  const now = new Date()
  const claimed = await prisma.job.updateMany({
    where: {
      id: input.jobId,
      orgId: input.orgId,
      type: "VERIFY_DRAFT",
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

export async function runGenerateFastPath(input: {
  jobId: string
  orgId: string
  workerId: string
  budgetMs: number
}) {
  // Only for GENERATE_DRAFT jobs. Must never drain arbitrary jobs.
  // If we can't claim the job immediately, we return without side effects.
  const now = new Date()
  const claimed = await prisma.job.updateMany({
    where: {
      id: input.jobId,
      orgId: input.orgId,
      type: "GENERATE_DRAFT",
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

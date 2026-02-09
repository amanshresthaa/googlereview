import { claimJobs, completeJob, markJobFailed, retryJob } from "@/lib/jobs/queue"
import { handleJob } from "@/lib/jobs/handlers"
import { NonRetryableError } from "@/lib/jobs/errors"

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
        results.push({ id: job.id, ok: false, error: err.message })
        continue
      }
      const attempts = job.attempts ?? 0
      const maxAttempts = job.maxAttempts ?? 10
      if (attempts + 1 >= maxAttempts) {
        await markJobFailed(job.id, err)
      } else {
        await retryJob(job.id, attempts, maxAttempts, err)
      }
      results.push({ id: job.id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { claimed: claimed.length, results }
}

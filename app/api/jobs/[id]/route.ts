import { z } from "zod"
import { prisma } from "@/lib/db"
import { handleAuthedGet } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"

export const runtime = "nodejs"

const paramsSchema = z.object({ id: z.string().min(1) })

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleAuthedGet(req, async ({ session }) => {
    const raw = await ctx.params
    const parsed = paramsSchema.safeParse(raw)
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid params.", details, fields })
    }

    const job = await prisma.job.findFirst({
      where: { id: parsed.data.id, orgId: session.orgId },
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        runAt: true,
        lockedAt: true,
        completedAt: true,
        lastError: true,
        lastErrorCode: true,
        lastErrorMetaJson: true,
      },
    })

    if (!job) throw new ApiError({ status: 404, code: "NOT_FOUND", message: "Job not found." })

    const lastErrorMeta = (job.lastErrorMetaJson ?? null) as Record<string, unknown> | null
    const metaRetryAfter = typeof lastErrorMeta?.retryAfterSec === "number" ? lastErrorMeta.retryAfterSec : null
    const computedRetryAfter = Math.ceil((job.runAt.getTime() - Date.now()) / 1000)
    const retryAfterSec =
      metaRetryAfter ??
      (job.status === "RETRYING" && computedRetryAfter > 0 ? computedRetryAfter : null)

    return {
      body: {
        job: {
          id: job.id,
          type: job.type,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          runAtIso: job.runAt.toISOString(),
          lockedAtIso: job.lockedAt?.toISOString() ?? null,
          completedAtIso: job.completedAt?.toISOString() ?? null,
          lastError: job.lastErrorCode ?? job.lastError ?? null,
          lastErrorMeta,
          retryAfterSec,
        },
      },
    }
  })
}

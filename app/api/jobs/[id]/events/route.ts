import { z } from "zod"

import { ApiError } from "@/lib/api/errors"
import { newRequestId } from "@/lib/api/json"
import { errJson } from "@/lib/api/response"
import { zodFields } from "@/lib/api/validation"
import { prisma } from "@/lib/db"
import { getJobDetailForOrg, isTerminalJobStatus } from "@/lib/jobs/system-health"
import { getReviewDetailForOrg, type ReviewDetailPayload } from "@/lib/reviews/detail"
import { requireApiSessionWithTiming } from "@/lib/session"

export const runtime = "nodejs"

const paramsSchema = z.object({ id: z.string().min(1) })
const querySchema = z.object({
  timeoutMs: z.coerce.number().int().min(1_000).max(30_000).optional(),
})

const STREAM_POLL_INTERVAL_MS = 900
const DEFAULT_STREAM_TIMEOUT_MS = 10_000

type JobDetail = Awaited<ReturnType<typeof getJobDetailForOrg>>

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveRetryAfterSec(job: JobDetail) {
  const lastErrorMeta = (job.lastErrorMeta ?? null) as { retryAfterSec?: unknown } | null
  const metaRetryAfter =
    typeof lastErrorMeta?.retryAfterSec === "number" && Number.isFinite(lastErrorMeta.retryAfterSec)
      ? Math.trunc(lastErrorMeta.retryAfterSec)
      : null
  const computedRetryAfter = Math.ceil((new Date(job.runAtIso).getTime() - Date.now()) / 1000)
  return metaRetryAfter ?? (job.status === "RETRYING" && computedRetryAfter > 0 ? computedRetryAfter : null)
}

function toEventJob(job: JobDetail) {
  return {
    ...job,
    retryAfterSec: resolveRetryAfterSec(job),
  }
}

function extractReviewIdentifiers(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { reviewId: null, draftReplyId: null }
  }
  const obj = payload as Record<string, unknown>
  return {
    reviewId: typeof obj.reviewId === "string" ? obj.reviewId : null,
    draftReplyId: typeof obj.draftReplyId === "string" ? obj.draftReplyId : null,
  }
}

async function resolveTerminalReviewSnapshot(input: {
  orgId: string
  payload: unknown
}): Promise<ReviewDetailPayload | null> {
  const ids = extractReviewIdentifiers(input.payload)
  let reviewId = ids.reviewId

  if (!reviewId && ids.draftReplyId) {
    const draft = await prisma.draftReply.findFirst({
      where: { id: ids.draftReplyId, orgId: input.orgId },
      select: { reviewId: true },
    })
    reviewId = draft?.reviewId ?? null
  }

  if (!reviewId) return null
  return getReviewDetailForOrg({ reviewId, orgId: input.orgId })
}

function writeSseEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: string,
  payload: unknown,
) {
  controller.enqueue(encoder.encode(`event: ${event}\n`))
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

function errorToJsonResponse(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return errJson({
      requestId,
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
      fields: error.fields,
    })
  }
  return errJson({
    requestId,
    status: 500,
    code: "INTERNAL",
    message: error instanceof Error ? error.message : "Internal error.",
  })
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId()
  const auth = await requireApiSessionWithTiming()
  const session = auth.session
  if (!session) {
    return errJson({
      requestId,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized.",
    })
  }

  const parsedParams = paramsSchema.safeParse(await ctx.params)
  if (!parsedParams.success) {
    const { details, fields } = zodFields(parsedParams.error)
    return errJson({
      requestId,
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid params.",
      details,
      fields,
    })
  }

  const url = new URL(req.url)
  const parsedQuery = querySchema.safeParse({
    timeoutMs: url.searchParams.get("timeoutMs") ?? undefined,
  })
  if (!parsedQuery.success) {
    const { details, fields } = zodFields(parsedQuery.error)
    return errJson({
      requestId,
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid query.",
      details,
      fields,
    })
  }

  const timeoutMs = parsedQuery.data.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS
  const { id: jobId } = parsedParams.data

  let initialJob: JobDetail
  try {
    initialJob = await getJobDetailForOrg({
      orgId: session.orgId,
      jobId,
      includePayload: true,
    })
  } catch (error) {
    return errorToJsonResponse(error, requestId)
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      let aborted = false

      const close = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Stream is already closed.
        }
      }

      const onAbort = () => {
        aborted = true
      }
      req.signal.addEventListener("abort", onAbort, { once: true })

      const emitJob = async (job: JobDetail, kind: "snapshot" | "transition" | "terminal") => {
        const review =
          kind === "terminal"
            ? await resolveTerminalReviewSnapshot({
                orgId: session.orgId,
                payload: job.payload,
              })
            : null

        writeSseEvent(controller, encoder, "job", {
          kind,
          job: toEventJob(job),
          review,
        })
      }

      try {
        let current = initialJob
        let currentStatus = initialJob.status
        const initialKind = isTerminalJobStatus(initialJob.status) ? "terminal" : "snapshot"
        await emitJob(initialJob, initialKind)
        if (initialKind === "terminal") {
          close()
          return
        }

        const deadline = Date.now() + timeoutMs
        while (!aborted && Date.now() < deadline) {
          await sleep(STREAM_POLL_INTERVAL_MS)
          if (aborted) break

          current = await getJobDetailForOrg({
            orgId: session.orgId,
            jobId,
            includePayload: true,
          })
          if (current.status === currentStatus) continue

          currentStatus = current.status
          const kind = isTerminalJobStatus(current.status) ? "terminal" : "transition"
          await emitJob(current, kind)
          if (kind === "terminal") {
            close()
            return
          }
        }

        if (!aborted) {
          writeSseEvent(controller, encoder, "timeout", {
            kind: "timeout",
            job: toEventJob(current),
          })
        }
      } catch (error) {
        if (!aborted) {
          writeSseEvent(controller, encoder, "error", {
            kind: "error",
            message: error instanceof Error ? error.message : "Stream error.",
          })
        }
      } finally {
        req.signal.removeEventListener("abort", onAbort)
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
    },
  })
}

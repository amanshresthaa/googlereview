import { z } from "zod"
import { handleAuthedGet, handleAuthedPost } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/errors"
import { zodFields } from "@/lib/api/validation"
import {
  assertOwner,
  enqueueJobsForOrg,
  listJobsForOrg,
} from "@/lib/jobs/system-health"
import { jobOrderSchema, jobStatusSchema, jobTypeSchema } from "@/lib/jobs/system-health.schemas"

export const runtime = "nodejs"

function parseMultiCsv(values: string[]): string[] | undefined {
  const out: string[] = []
  for (const v of values) {
    for (const part of v.split(",")) {
      const trimmed = part.trim()
      if (trimmed) out.push(trimmed)
    }
  }
  return out.length ? out : undefined
}

const querySchema = z.object({
  status: z.array(jobStatusSchema).optional(),
  type: z.array(jobTypeSchema).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  order: jobOrderSchema.optional(),
  q: z.string().min(1).max(120).optional(),
  stale: z.enum(["0", "1"]).optional(),
  includePayload: z.enum(["0", "1"]).optional(),
})

export async function GET(req: Request) {
  return handleAuthedGet(req, async ({ session, url }) => {
    const parsed = querySchema.safeParse({
      status: parseMultiCsv(url.searchParams.getAll("status")),
      type: parseMultiCsv(url.searchParams.getAll("type")),
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      stale: url.searchParams.get("stale") ?? undefined,
      includePayload: url.searchParams.get("includePayload") ?? undefined,
    })
    if (!parsed.success) {
      const { details, fields } = zodFields(parsed.error)
      throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid query.", details, fields })
    }

    const includePayload = parsed.data.includePayload === "1"
    const order = parsed.data.order ?? "CREATED_AT_DESC"
    const stale = parsed.data.stale === "1"

    const result = await listJobsForOrg({
      orgId: session.orgId,
      filter: {
        status: parsed.data.status,
        type: parsed.data.type,
        cursor: parsed.data.cursor,
        limit: parsed.data.limit,
        order,
        q: parsed.data.q,
        stale: stale || undefined,
        includePayload,
      },
    })

    const cacheControl =
      order === "RUN_AT_ASC" ? "private, no-store" : "private, max-age=5, stale-while-revalidate=30"

    return {
      body: result,
      headers: {
        "Cache-Control": cacheControl,
      },
    }
  })
}

export async function POST(req: Request) {
  return handleAuthedPost(
    req,
    {
      rateLimitScope: "JOBS_ADMIN",
      idempotency: { required: true },
    },
    async ({ session, requestId, body }) => {
      assertOwner(session.role ?? "")

      const result = await enqueueJobsForOrg({
        orgId: session.orgId,
        requestId,
        actorUserId: session.user.id,
        body,
      })

      return {
        body: {
          jobIds: result.jobIds,
        },
      }
    },
  )
}

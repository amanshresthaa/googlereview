import fs from "node:fs"
import path from "node:path"
import { z } from "zod"
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi"

// Generates OpenAPI 3.1 spec for production APIs (excluding /api/test/* and /api/auth/*).
// This is code-first and should stay aligned with handlers (additive ok/requestId envelope).

const registry = new OpenAPIRegistry()
extendZodWithOpenApi(z)

const RequestId = z.string().uuid()

const ErrorResponse = z
  .object({
    ok: z.literal(false),
    requestId: RequestId,
    error: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  })
  .strict()

function withOk<T extends z.ZodTypeAny>(schema: T) {
  // Additive-only: keep existing top-level fields; add ok/requestId.
  // We only apply this helper to object schemas.
  if (!(schema instanceof z.ZodObject)) return schema
  return schema.extend({ ok: z.literal(true), requestId: RequestId })
}

const ReviewFilter = z.enum(["unanswered", "urgent", "five_star", "mentions", "all"])

const ReviewRow = z.object({
  id: z.string(),
  starRating: z.number().int().min(1).max(5),
  snippet: z.string(),
  createTimeIso: z.string(),
  location: z.object({ id: z.string(), displayName: z.string() }),
  unanswered: z.boolean(),
  draftStatus: z.string().nullable(),
  mentions: z.array(z.string()),
})

const ReviewCounts = z.object({
  unanswered: z.number().int().nonnegative(),
  urgent: z.number().int().nonnegative(),
  five_star: z.number().int().nonnegative(),
  mentions_total: z.number().int().nonnegative(),
})

const ReviewsListResponse = withOk(
  z.object({
    rows: z.array(ReviewRow),
    nextCursor: z.string().nullable(),
    counts: ReviewCounts,
  })
)

const DraftReply = z.object({
  id: z.string(),
  orgId: z.string(),
  reviewId: z.string(),
  version: z.number().int(),
  text: z.string(),
  origin: z.enum(["AUTO", "REGENERATED", "USER_EDITED"]),
  status: z.enum(["NEEDS_APPROVAL", "BLOCKED_BY_VERIFIER", "READY", "POSTED", "POST_FAILED"]),
  evidenceSnapshotJson: z.unknown(),
  verifierResultJson: z.unknown().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

const ReviewDetailResponse = withOk(
  z.object({
    id: z.string(),
    starRating: z.number().int().min(1).max(5),
    comment: z.string().nullable(),
    createTime: z.string(),
    updateTime: z.string(),
    reviewer: z.object({ displayName: z.string().nullable(), isAnonymous: z.boolean() }),
    reply: z.object({ comment: z.string().nullable(), updateTime: z.string().nullable() }),
    location: z.object({ id: z.string(), name: z.string() }),
    mentions: z.array(z.string()),
    currentDraft: DraftReply.nullable(),
    drafts: z.array(DraftReply),
  })
)

const WorkerResult = z.object({ id: z.string(), ok: z.boolean(), error: z.string().optional() })
const WorkerRun = z.object({ claimed: z.number().int().nonnegative(), results: z.array(WorkerResult) })

const JobEnqueueResponse = withOk(z.object({ jobId: z.string(), worker: WorkerRun }))
const BulkApproveResponse = withOk(z.object({ jobIds: z.array(z.string()), worker: WorkerRun }))
const SyncReviewsResponse = withOk(z.object({ jobIds: z.array(z.string()), worker: WorkerRun }))
const EditDraftResponse = withOk(z.object({ draftReplyId: z.string(), verifyJobId: z.string(), worker: WorkerRun }))
const LocationsSelectResponse = withOk(z.object({ worker: WorkerRun }))
const SettingsUpdateResponse = withOk(z.object({}))

const JobSummaryResponse = withOk(
  z.object({
    summary: z.object({
      byType: z.record(
        z.string(),
        z.object({
          pending: z.number().int().nonnegative(),
          running: z.number().int().nonnegative(),
          retrying: z.number().int().nonnegative(),
          failed_24h: z.number().int().nonnegative(),
        })
      ),
      recentFailures: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          completedAtIso: z.string().nullable(),
          lastError: z.string().nullable(),
        })
      ),
    }),
  })
)

const JobDetailResponse = withOk(
  z.object({
    job: z.object({
      id: z.string(),
      type: z.string(),
      status: z.string(),
      attempts: z.number().int(),
      maxAttempts: z.number().int(),
      runAtIso: z.string(),
      lockedAtIso: z.string().nullable(),
      completedAtIso: z.string().nullable(),
      lastError: z.string().nullable(),
    }),
  })
)

const CronWorkerResponse = withOk(
  z.object({
    disabled: z.boolean().optional(),
    scheduled: z.unknown().optional(),
    worker: WorkerRun.optional(),
  })
)

const IdempotencyKeyHeader = z.string().uuid()

function registerAuthedGet(pathStr: string, input: { summary: string; params?: z.ZodTypeAny; query?: z.ZodTypeAny; response: z.ZodTypeAny }) {
  const request: Record<string, unknown> = {}
  if (input.params) request.params = input.params
  if (input.query) request.query = input.query

  registry.registerPath({
    method: "get",
    path: pathStr,
    summary: input.summary,
    request: Object.keys(request).length ? (request as never) : undefined,
    responses: {
      200: { description: "OK", content: { "application/json": { schema: input.response } } },
      400: { description: "Bad Request", content: { "application/json": { schema: ErrorResponse } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
      403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponse } } },
      404: { description: "Not Found", content: { "application/json": { schema: ErrorResponse } } },
      429: { description: "Rate Limited", content: { "application/json": { schema: ErrorResponse } } },
      500: { description: "Internal", content: { "application/json": { schema: ErrorResponse } } },
    },
  })
}

function registerAuthedPost(pathStr: string, input: { summary: string; body?: z.ZodTypeAny; response: z.ZodTypeAny }) {
  registry.registerPath({
    method: "post",
    path: pathStr,
    summary: input.summary,
    request: {
      headers: z.object({
        "Idempotency-Key": IdempotencyKeyHeader,
      }),
      body: input.body ? { content: { "application/json": { schema: input.body } } } : undefined,
    },
    responses: {
      200: { description: "OK", content: { "application/json": { schema: input.response } } },
      201: { description: "Created", content: { "application/json": { schema: input.response } } },
      204: { description: "No Content" },
      400: { description: "Bad Request", content: { "application/json": { schema: ErrorResponse } } },
      401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
      403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponse } } },
      404: { description: "Not Found", content: { "application/json": { schema: ErrorResponse } } },
      409: { description: "Conflict", content: { "application/json": { schema: ErrorResponse } } },
      428: { description: "Idempotency Required", content: { "application/json": { schema: ErrorResponse } } },
      429: { description: "Rate Limited", content: { "application/json": { schema: ErrorResponse } } },
      500: { description: "Internal", content: { "application/json": { schema: ErrorResponse } } },
      503: { description: "Upstream Unavailable", content: { "application/json": { schema: ErrorResponse } } },
    },
  })
}

registerAuthedGet("/api/reviews", {
  summary: "List reviews (paginated).",
  query: z.object({
    filter: ReviewFilter.optional(),
    mention: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
  }),
  response: ReviewsListResponse,
})

registerAuthedGet("/api/reviews/{id}", {
  summary: "Get review detail.",
  params: z.object({ id: z.string().min(1) }),
  response: ReviewDetailResponse,
})

registerAuthedPost("/api/reviews/{id}/drafts/generate", {
  summary: "Enqueue draft generation.",
  response: JobEnqueueResponse,
})

registerAuthedPost("/api/reviews/{id}/drafts/edit", {
  summary: "Create a new draft version from user edit; enqueues verifier.",
  body: z.object({ text: z.string().min(1).max(10_000) }),
  response: EditDraftResponse,
})

registerAuthedPost("/api/reviews/{id}/drafts/verify", {
  summary: "Enqueue verifier for current draft (and optionally run bounded fast-path).",
  response: JobEnqueueResponse,
})

registerAuthedPost("/api/reviews/{id}/reply/post", {
  summary: "Enqueue posting current draft as Google reply.",
  response: JobEnqueueResponse,
})

registerAuthedPost("/api/replies/bulk-approve", {
  summary: "Bulk approve (post replies) for eligible 5-star READY drafts.",
  body: z.object({ reviewIds: z.array(z.string().min(1)).min(1).max(50) }),
  response: BulkApproveResponse,
})

registerAuthedGet("/api/jobs/summary", {
  summary: "Get job summary for org.",
  response: JobSummaryResponse,
})

registerAuthedGet("/api/jobs/{id}", {
  summary: "Get job detail.",
  params: z.object({ id: z.string().min(1) }),
  response: JobDetailResponse,
})

registerAuthedPost("/api/settings/update", {
  summary: "Update org settings.",
  body: z
    .object({
      tonePreset: z.string().min(1).max(50).optional(),
      toneCustomInstructions: z.string().max(2000).nullable().optional(),
      autoDraftEnabled: z.boolean().optional(),
      autoDraftForRatings: z.array(z.number().int().min(1).max(5)).max(5).optional(),
      bulkApproveEnabledForFiveStar: z.boolean().optional(),
      aiProvider: z.enum(["OPENAI", "GEMINI"]).optional(),
      mentionKeywords: z.array(z.string().min(1).max(40)).max(50).optional(),
    })
    .strict(),
  response: SettingsUpdateResponse,
})

registerAuthedPost("/api/google/sync-locations", {
  summary: "Enqueue syncing locations from Google.",
  response: JobEnqueueResponse,
})

registerAuthedPost("/api/google/sync-reviews", {
  summary: "Enqueue syncing reviews from Google for enabled locations (or specific locationIds).",
  body: z.object({ locationIds: z.array(z.string().min(1)).max(200).optional() }).strict(),
  response: SyncReviewsResponse,
})

registerAuthedPost("/api/locations/select", {
  summary: "Enable selected locations and enqueue review syncs.",
  body: z.object({ enabledLocationIds: z.array(z.string().min(1)).max(200) }),
  response: LocationsSelectResponse,
})

// Cron is bearer-auth protected (and can be disabled via DISABLE_CRON).
registry.registerPath({
  method: "get",
  path: "/api/cron/worker",
  summary: "Cron worker entrypoint (bearer auth).",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: CronWorkerResponse } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
  },
})
registry.registerPath({
  method: "post",
  path: "/api/cron/worker",
  summary: "Cron worker entrypoint (bearer auth).",
  responses: {
    200: { description: "OK", content: { "application/json": { schema: CronWorkerResponse } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponse } } },
  },
})

const generator = new OpenApiGeneratorV31(registry.definitions)
const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: { title: "GBP Reviews API", version: "0.1.0" },
  servers: [{ url: "http://localhost:3000" }],
})

doc.components = {
  ...(doc.components ?? {}),
  securitySchemes: {
    cookieAuth: { type: "apiKey", in: "cookie", name: "next-auth.session-token" },
    bearerAuth: { type: "http", scheme: "bearer" },
  },
}

// Attach default security for authed routes (documentational; actual auth is session cookie).
for (const [p, methods] of Object.entries(doc.paths ?? {})) {
  for (const op of Object.values(methods ?? {})) {
    if (!op || typeof op !== "object") continue
    const opObj = op as unknown as { security?: unknown }
    // Cron is bearer-auth; everything else (except /api/auth/* and /api/test/* which are excluded) is cookie-auth.
    if (p.startsWith("/api/cron/")) {
      opObj.security = [{ bearerAuth: [] }]
    } else {
      opObj.security = [{ cookieAuth: [] }]
    }
  }
}

const outPath = path.join(process.cwd(), "openapi.json")
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n", "utf8")
console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)`)

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockState = vi.hoisted(() => ({
  session: {
    orgId: "org-test",
    role: "OWNER",
    user: { id: "user-test" },
  },
  requestId: "req-test",
}))

const mockFns = vi.hoisted(() => ({
  handleAuthedPost: vi.fn(),
  enqueueJob: vi.fn(),
  runPostReplyFastPath: vi.fn(),
  reviewFindFirst: vi.fn(),
  reviewFindMany: vi.fn(),
  orgSettingsFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock("@/lib/api/handler", () => ({
  handleAuthedPost: mockFns.handleAuthedPost,
}))

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: mockFns.enqueueJob,
}))

vi.mock("@/lib/jobs/worker", () => ({
  runPostReplyFastPath: mockFns.runPostReplyFastPath,
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    review: {
      findFirst: mockFns.reviewFindFirst,
      findMany: mockFns.reviewFindMany,
    },
    orgSettings: {
      findUnique: mockFns.orgSettingsFindUnique,
    },
    auditLog: {
      create: mockFns.auditCreate,
    },
  },
}))

import { POST as postSingleReply } from "@/app/api/reviews/[id]/reply/post/route"
import { POST as postBulkApprove } from "@/app/api/replies/bulk-approve/route"

describe("post reply dedup contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFns.handleAuthedPost.mockImplementation(
      async (
        req: Request,
        opts: { readBody?: boolean },
        handler: (args: { session: typeof mockState.session; requestId: string; body?: unknown }) => Promise<unknown>,
      ) => {
        const body = opts.readBody === false ? undefined : await req.clone().json().catch(() => undefined)
        return handler({
          session: mockState.session,
          requestId: mockState.requestId,
          body,
        })
      },
    )

    mockFns.auditCreate.mockResolvedValue({ id: "audit-1" })
    mockFns.runPostReplyFastPath.mockResolvedValue({ claimed: 0, results: [] })
  })

  it("uses canonical POST_REPLY dedup key for single review post", async () => {
    mockFns.reviewFindFirst.mockResolvedValue({
      googleReplyComment: null,
      currentDraftReplyId: "draft-1",
      currentDraftReply: { status: "READY" },
    })
    mockFns.enqueueJob.mockResolvedValue({
      id: "job-single",
      status: "PENDING",
    })

    await postSingleReply(
      new Request("http://localhost/api/reviews/rev-1/reply/post", {
        method: "POST",
        headers: { "Idempotency-Key": "11111111-1111-4111-8111-111111111111" },
      }),
      { params: Promise.resolve({ id: "rev-1" }) },
    )

    expect(mockFns.enqueueJob).toHaveBeenCalledTimes(1)
    expect(mockFns.enqueueJob.mock.calls[0]?.[0]).toMatchObject({
      type: "POST_REPLY",
      dedupKey: "review:rev-1:post",
    })
  })

  it("uses the same canonical POST_REPLY dedup key contract in bulk approve", async () => {
    mockFns.orgSettingsFindUnique.mockResolvedValue({
      bulkApproveEnabledForFiveStar: true,
    })
    mockFns.reviewFindMany.mockResolvedValue([
      {
        id: "rev-1",
        starRating: 5,
        googleReplyComment: null,
        currentDraftReplyId: "draft-1",
        currentDraftReply: { status: "READY" },
        location: { enabled: true },
      },
      {
        id: "rev-2",
        starRating: 5,
        googleReplyComment: null,
        currentDraftReplyId: "draft-2",
        currentDraftReply: { status: "READY" },
        location: { enabled: true },
      },
    ])
    mockFns.enqueueJob.mockImplementation(async (input: { dedupKey: string }) => ({
      id: `job:${input.dedupKey}`,
      status: "PENDING",
    }))

    await postBulkApprove(
      new Request("http://localhost/api/replies/bulk-approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": "22222222-2222-4222-8222-222222222222",
        },
        body: JSON.stringify({ reviewIds: ["rev-1", "rev-2"] }),
      }),
    )

    const dedupKeys = mockFns.enqueueJob.mock.calls.map((call) => call[0]?.dedupKey)
    expect(dedupKeys).toEqual(["review:rev-1:post", "review:rev-2:post"])
  })
})

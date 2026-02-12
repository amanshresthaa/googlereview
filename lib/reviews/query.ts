import {
  decodeReviewsCursor,
  encodeReviewsCursor,
} from "@/lib/reviews/listing"
import type { ReviewListCounts, ReviewListPage } from "@/lib/reviews/types"

import {
  getReviewCountsForOrg,
  getReviewCountsForOrgWithTiming,
  invalidateReviewCountsCache,
} from "./query-internals/counts"
import { listReviewsBySql } from "./query-internals/fts"
import { toReviewListRow, type ReviewListRecord } from "./query-internals/records"
import type { ListReviewsPageInput, ReviewListQueryTiming, ReviewsCursor } from "./query-internals/types"

export type { ReviewCountsQueryTiming, ReviewListQueryTiming } from "./query-internals/types"
export { getReviewCountsForOrg, getReviewCountsForOrgWithTiming, invalidateReviewCountsCache }

function decodeCursorOrThrow(cursor: string | undefined): ReviewsCursor | undefined {
  if (!cursor) return undefined
  try {
    return decodeReviewsCursor(cursor)
  } catch {
    throw new Error("BAD_CURSOR")
  }
}

async function fetchReviewItems(input: {
  query: ListReviewsPageInput
  mention?: string
  decodedCursor?: ReviewsCursor
  searchTerm?: string
}): Promise<{ items: ReviewListRecord[]; listMs: number }> {
  const { query, mention, decodedCursor, searchTerm } = input
  const listStartedAt = Date.now()
  const items = await listReviewsBySql({
    orgId: query.orgId,
    search: searchTerm,
    filter: query.filter,
    mention,
    status: query.status,
    locationId: query.locationId,
    rating: query.rating,
    cursor: decodedCursor,
    limit: query.limit + 1,
  })

  return { items, listMs: Date.now() - listStartedAt }
}

export async function listReviewsPageWithTiming(
  input: ListReviewsPageInput,
): Promise<{ page: ReviewListPage; timing: ReviewListQueryTiming }> {
  const startedAt = Date.now()
  const mention = input.mention?.trim().toLowerCase()
  if (input.filter === "mentions" && !mention) {
    throw new Error("MENTION_REQUIRED")
  }

  const decodedCursor = decodeCursorOrThrow(input.cursor)
  const includeCounts = (input.includeCounts ?? true) && !input.cursor
  const searchTerm = input.search?.trim()

  const listPromise = fetchReviewItems({
    query: input,
    mention,
    decodedCursor,
    searchTerm,
  })

  const countsPromise: Promise<{ counts: ReviewListCounts | null; countsMs: number; countsCacheHit: boolean }> = includeCounts
    ? (async () => {
        const { counts, timing } = await getReviewCountsForOrgWithTiming(input.orgId)
        return { counts, countsMs: timing.countsMs, countsCacheHit: timing.cacheHit }
      })()
    : Promise.resolve({ counts: null, countsMs: 0, countsCacheHit: false })

  const [{ items, listMs }, { counts, countsMs, countsCacheHit }] = await Promise.all([listPromise, countsPromise])

  const hasMore = items.length > input.limit
  const page = items.slice(0, input.limit)
  const last = page.at(-1)
  const nextCursor =
    hasMore && last ? encodeReviewsCursor({ t: last.createTime.toISOString(), id: last.id }) : null

  const response: ReviewListPage = {
    rows: page.map(toReviewListRow),
    nextCursor,
  }
  if (includeCounts) {
    response.counts = counts ?? undefined
  }

  return {
    page: response,
    timing: {
      includeCounts,
      listMs,
      countsMs,
      countsCacheHit,
      totalMs: Date.now() - startedAt,
    },
  }
}

export async function listReviewsPage(input: ListReviewsPageInput): Promise<ReviewListPage> {
  const { page } = await listReviewsPageWithTiming(input)
  return page
}

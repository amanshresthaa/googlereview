import { prisma } from "@/lib/db"
import { REVIEWS_PAGE_SIZE } from "@/lib/reviews/constants"
import { listReviewsPageWithTiming } from "@/lib/reviews/query"
import type { ReviewsFilter, ReviewsStatus } from "@/lib/reviews/listing"

export type BootstrapInput = {
  orgId: string
  filter?: ReviewsFilter
  status?: ReviewsStatus
  mention?: string
  locationId?: string
  rating?: number
  search?: string
  includeCounts?: boolean
}

export async function fetchInboxBootstrap(input: BootstrapInput) {
  const filter = input.filter ?? "unanswered"
  const status = input.status ?? "all"
  const includeCounts = input.includeCounts ?? false

  const [settings, locations] = await Promise.all([
    prisma.orgSettings.findUnique({
      where: { orgId: input.orgId },
      select: { mentionKeywords: true, bulkApproveEnabledForFiveStar: true },
    }),
    prisma.location.findMany({
      where: { orgId: input.orgId, enabled: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ])

  const { page } = await listReviewsPageWithTiming({
    orgId: input.orgId,
    filter,
    status,
    mention: input.mention,
    locationId: input.locationId,
    rating: input.rating,
    search: input.search,
    limit: REVIEWS_PAGE_SIZE,
    includeCounts,
  })

  return {
    mentionKeywords: settings?.mentionKeywords ?? [],
    bulkApproveEnabled: settings?.bulkApproveEnabledForFiveStar ?? true,
    locations,
    initialPage: {
      ...page,
      filter,
      status,
      mention: input.mention ?? null,
    },
  }
}

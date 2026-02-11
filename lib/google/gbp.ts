import { googleFetchJson } from "@/lib/google/http"

export type GoogleAccount = {
  name: string // accounts/{accountId}
  accountName?: string
  type?: string
  verificationState?: string
}

export type GoogleLocation = {
  // Business Information API returns resource names like: locations/{locationId}
  // Some legacy surfaces may still use: accounts/{accountId}/locations/{locationId}
  name: string
  title?: string
  storeCode?: string
  storefrontAddress?: {
    addressLines?: string[]
    locality?: string
    administrativeArea?: string
    postalCode?: string
    regionCode?: string
  }
}

export type GoogleReview = {
  name: string
  reviewId: string
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"
  comment?: string
  createTime: string
  updateTime: string
  reviewer?: {
    displayName?: string
    isAnonymous?: boolean
  }
  reviewReply?: {
    comment?: string
    updateTime?: string
  }
}

export async function listAccounts(accessToken: string) {
  const out: GoogleAccount[] = []
  let pageToken: string | undefined
  for (let i = 0; i < 50; i++) {
    const base = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20"
    const url = pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base
    const res = await googleFetchJson<{
      accounts?: GoogleAccount[]
      nextPageToken?: string
    }>({
      accessToken,
      url,
    })
    out.push(...(res.accounts ?? []))
    if (!res.nextPageToken) break
    pageToken = res.nextPageToken
  }
  return out
}

export async function listLocations(accessToken: string, accountName: string) {
  if (!/^accounts\/[^/]+$/.test(accountName)) {
    throw new Error(`Invalid account resource name: ${accountName}`)
  }
  const readMask = ["name", "title", "storeCode", "storefrontAddress"].join(",")
  const out: GoogleLocation[] = []
  let pageToken: string | undefined
  for (let i = 0; i < 200; i++) {
    const base =
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
      `?readMask=${encodeURIComponent(readMask)}&pageSize=100`
    const url = pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base
    const res = await googleFetchJson<{
      locations?: GoogleLocation[]
      nextPageToken?: string
    }>({
      accessToken,
      url,
    })
    out.push(...(res.locations ?? []))
    if (!res.nextPageToken) break
    pageToken = res.nextPageToken
  }
  return out
}

export async function listReviews(
  accessToken: string,
  locationName: string,
  pageToken?: string
) {
  if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(locationName)) {
    throw new Error(`Invalid location resource name: ${locationName}`)
  }
  const base =
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=50&orderBy=updateTime%20desc`
  const url = pageToken ? `${base}&pageToken=${encodeURIComponent(pageToken)}` : base

  const res = await googleFetchJson<{ reviews?: GoogleReview[]; nextPageToken?: string }>({
    accessToken,
    url,
  })
  return { reviews: res.reviews ?? [], nextPageToken: res.nextPageToken }
}

export async function getReview(accessToken: string, reviewName: string) {
  if (!/^accounts\/[^/]+\/locations\/[^/]+\/reviews\/[^/]+$/.test(reviewName)) {
    throw new Error(`Invalid review resource name: ${reviewName}`)
  }
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}`
  return googleFetchJson<GoogleReview>({ accessToken, url })
}

export async function updateReviewReply(accessToken: string, reviewName: string, comment: string) {
  if (!/^accounts\/[^/]+\/locations\/[^/]+\/reviews\/[^/]+$/.test(reviewName)) {
    throw new Error(`Invalid review resource name: ${reviewName}`)
  }
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`
  return googleFetchJson<{ comment?: string; updateTime?: string }>({
    accessToken,
    url,
    method: "PUT",
    bodyJson: { comment },
  })
}

export function parseAccountId(accountName: string) {
  const m = accountName.match(/^accounts\/(.+)$/)
  if (!m) throw new Error(`Unexpected account name: ${accountName}`)
  return m[1]!
}

export function parseLocationIds(locationName: string) {
  const m = locationName.match(/^accounts\/([^/]+)\/locations\/([^/]+)$/)
  if (m) return { accountId: m[1]!, locationId: m[2]! }

  // Business Information API v1 commonly returns: locations/{locationId}
  const m2 = locationName.match(/^locations\/([^/]+)$/)
  if (m2) return { accountId: null, locationId: m2[1]! }

  throw new Error(`Unexpected location name: ${locationName}`)
}

export function parseLocationId(locationName: string) {
  return parseLocationIds(locationName).locationId
}

export function starRatingToInt(rating: GoogleReview["starRating"]) {
  switch (rating) {
    case "ONE":
      return 1
    case "TWO":
      return 2
    case "THREE":
      return 3
    case "FOUR":
      return 4
    case "FIVE":
      return 5
  }
}

export function formatAddressSummary(loc: GoogleLocation) {
  const a = loc.storefrontAddress
  if (!a) return null
  const parts = [
    ...(a.addressLines ?? []),
    a.locality,
    a.administrativeArea,
    a.postalCode,
    a.regionCode,
  ].filter(Boolean)
  const text = parts.join(", ").trim()
  return text.length ? text : null
}

import { RetryableJobError } from "@/lib/jobs/errors"

type GoogleFetchOptions = {
  accessToken: string
  url: string
  method?: string
  bodyJson?: unknown
  signal?: AbortSignal
}

export async function googleFetchJson<T>({
  accessToken,
  url,
  method = "GET",
  bodyJson,
  signal,
}: GoogleFetchOptions): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: bodyJson ? JSON.stringify(bodyJson) : undefined,
      signal,
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    if (name === "AbortError") {
      throw new RetryableJobError("UPSTREAM_TIMEOUT", "Google API request timed out.")
    }
    throw new RetryableJobError("UPSTREAM_TIMEOUT", "Google API request failed.")
  }

  if (!res.ok) {
    // Never include upstream response bodies (could contain PII).
    if (res.status === 408) {
      throw new RetryableJobError("UPSTREAM_TIMEOUT", "Google API timeout.", { status: res.status })
    }
    if (res.status === 429) {
      throw new RetryableJobError("UPSTREAM_RATE_LIMITED", "Google API rate limited.", { status: res.status })
    }
    if (res.status >= 500) {
      throw new RetryableJobError("UPSTREAM_5XX", "Google API server error.", { status: res.status })
    }
    throw new RetryableJobError("UPSTREAM_4XX", "Google API client error.", { status: res.status })
  }

  return (await res.json()) as T
}

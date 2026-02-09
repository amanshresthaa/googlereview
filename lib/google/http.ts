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
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": bodyJson ? "application/json" : "application/json",
    },
    body: bodyJson ? JSON.stringify(bodyJson) : undefined,
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google API error ${res.status}: ${text}`)
  }

  return (await res.json()) as T
}


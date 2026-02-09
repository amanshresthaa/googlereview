"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type LocationRow = {
  id: string
  displayName: string
  addressSummary: string | null
  storeCode: string | null
  enabled: boolean
}

type WorkerResult = { id: string; ok: boolean; error?: string }

function formatSyncError(input: unknown) {
  const raw = typeof input === "string" ? input : input instanceof Error ? input.message : String(input)
  if (raw.includes("mybusinessaccountmanagement.googleapis.com") || raw.includes("SERVICE_DISABLED")) {
    const activationUrlMatch = raw.match(/\"activationUrl\"\\s*:\\s*\"([^\"]+)\"/)
    const url = activationUrlMatch?.[1]
    const base =
      "Google API is disabled for the OAuth project. Enable the My Business Account Management API and retry."
    return url ? `${base} (${url})` : base
  }
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw
}

export function LocationSelectorClient(props: { locations: LocationRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = React.useState(() => {
    const s = new Set<string>()
    for (const l of props.locations) if (l.enabled) s.add(l.id)
    return s
  })
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function syncLocations() {
    setBusy("sync")
    setError(null)
    try {
      const res = await fetch("/api/google/sync-locations", { method: "POST" })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as {
        ok?: boolean
        jobId?: string
        worker?: { claimed: number; results: WorkerResult[] }
      }
      const firstFailure = json.worker?.results?.find((r) => !r.ok && r.error)
      if (firstFailure?.error) {
        throw new Error(firstFailure.error)
      }
      router.refresh()
    } catch (e) {
      setError(formatSyncError(e))
    } finally {
      setBusy(null)
    }
  }

  async function saveSelection() {
    setBusy("save")
    setError(null)
    try {
      const res = await fetch("/api/locations/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabledLocationIds: Array.from(selected) }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.push("/inbox")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={syncLocations} disabled={busy !== null}>
          {busy === "sync" ? "Syncing..." : "Sync locations"}
        </Button>
        <Button
          variant="secondary"
          onClick={saveSelection}
          disabled={busy !== null || selected.size === 0}
        >
          {busy === "save" ? "Saving..." : `Save selection (${selected.size})`}
        </Button>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="divide-border rounded-md border">
        {props.locations.length === 0 ? (
          <div className="text-muted-foreground p-4 text-sm">
            No locations yet. Click Sync locations.
          </div>
        ) : (
          props.locations.map((l) => {
            const checked = selected.has(l.id)
            return (
              <label
                key={l.id}
                className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 p-4"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(l.id)
                      else next.delete(l.id)
                      return next
                    })
                  }}
                  className="mt-1"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{l.displayName}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {[l.storeCode, l.addressSummary].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

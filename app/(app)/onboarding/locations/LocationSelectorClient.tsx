"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Check, Loader2 } from "lucide-react"
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
    const activationUrlMatch = raw.match(/\"activationUrl\"\s*:\s*\"([^\"]+)\"/)
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
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={syncLocations} disabled={busy !== null}>
          {busy === "sync" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Sync locations
        </Button>
        <Button size="sm" onClick={saveSelection} disabled={busy !== null || selected.size === 0}>
          {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save ({selected.size})
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="rounded-lg border border-border divide-y divide-border">
        {props.locations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No locations found. Click Sync locations.</p>
        ) : (
          props.locations.map((l) => {
            const checked = selected.has(l.id)
            return (
              <label
                key={l.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
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
                  className="accent-primary size-3.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{l.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[l.storeCode, l.addressSummary].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

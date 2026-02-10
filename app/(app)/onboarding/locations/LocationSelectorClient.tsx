"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MapPin, CheckCircle2, RefreshCw, Loader2, Search, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

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
    const activationUrlMatch = raw.match(/"activationUrl"\s*:\s*"([^"]+)"/)
    const url = activationUrlMatch?.[1]
    const base =
      "Google API is disabled for the OAuth project. Enable the My Business Account Management API and retry."
    return url ? `${base} (${url})` : base
  }
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw
}

export function LocationSelectorClient({ locations }: { locations: LocationRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = React.useState(() => {
    const s = new Set<string>()
    for (const l of locations) if (l.enabled) s.add(l.id)
    return s
  })
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!query.trim()) return locations
    const q = query.toLowerCase()
    return locations.filter(
      (l) =>
        l.displayName.toLowerCase().includes(q) ||
        l.addressSummary?.toLowerCase().includes(q)
    )
  }, [locations, query])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(locations.map((l) => l.id)))
  const deselectAll = () => setSelected(new Set())

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
      if (firstFailure?.error) throw new Error(firstFailure.error)
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
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-stone-400" />
          <Input
            placeholder="Search locations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 border-stone-200 focus-visible:ring-emerald-500"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={syncLocations}
          disabled={busy !== null}
          className="border-stone-200 text-stone-700 hover:bg-stone-50"
        >
          {busy === "sync" ? (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="size-3.5 mr-1.5" />
          )}
          Sync
        </Button>
      </div>

      {locations.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {selected.size} of {locations.length} selected
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-xs text-emerald-700 hover:underline font-medium">
              Select All
            </button>
            <span className="text-xs text-stone-300">|</span>
            <button type="button" onClick={deselectAll} className="text-xs text-stone-500 hover:underline font-medium">
              Deselect All
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((loc) => {
          const isSelected = selected.has(loc.id)
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => toggle(loc.id)}
              className={`w-full text-left p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center justify-between group ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50/40"
                  : "border-stone-150 bg-white hover:border-stone-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : "bg-stone-100 text-stone-400 group-hover:text-stone-500"
                  }`}
                >
                  <MapPin size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-stone-900">{loc.displayName}</h4>
                  <p className="text-xs text-stone-500">
                    {[loc.storeCode, loc.addressSummary].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              {isSelected && <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />}
            </button>
          )
        })}
        {locations.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl">
            <MapPin className="size-8 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-500 text-sm">No locations found. Click Sync to pull from Google.</p>
          </div>
        )}
        {locations.length > 0 && filtered.length === 0 && (
          <p className="text-center py-6 text-sm text-stone-400">No locations match your search.</p>
        )}
      </div>

      <Button
        className="w-full py-6 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={saveSelection}
        disabled={busy !== null}
      >
        {busy === "save" ? (
          <Loader2 className="size-4 animate-spin mr-2" />
        ) : null}
        {busy === "save"
          ? "Saving..."
          : <>
              Save & Continue
              <Badge variant="secondary" className="ml-2 bg-emerald-500 text-white hover:bg-emerald-500">
                {selected.size}
              </Badge>
              <ArrowRight size={18} className="ml-1.5" />
            </>
        }
      </Button>
    </div>
  )
}

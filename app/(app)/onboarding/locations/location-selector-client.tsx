"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { useGlobalSearch } from "@/components/search-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RefreshCw, Search, MapPin, Loader2, LayoutDashboard, CheckCircle2 } from "@/components/icons"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { cn } from "@/lib/utils"

type LocationRow = {
  id: string
  displayName: string
  storeCode: string | null
  addressSummary: string | null
  enabled: boolean
}

export function LocationSelectorClient({
  mode,
  locations,
}: {
  mode: "onboarding" | "manage"
  locations: LocationRow[]
}) {
  const router = useRouter()
  const { query } = useGlobalSearch()

  const [busy, setBusy] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(locations.filter((l) => l.enabled).map((l) => l.id))
  )

  React.useEffect(() => {
    setSelected(new Set(locations.filter((l) => l.enabled).map((l) => l.id)))
  }, [locations])

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return locations
    return locations.filter((l) => {
      return (
        l.displayName.toLowerCase().includes(q) ||
        (l.storeCode ?? "").toLowerCase().includes(q) ||
        (l.addressSummary ?? "").toLowerCase().includes(q)
      )
    })
  }, [locations, query])

  const selectAll = () => setSelected(new Set(visible.map((l) => l.id)))
  const deselectAll = () => setSelected(new Set())

  const toggle = (id: string, val: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (val) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const runSyncPolling = async () => {
    const start = Date.now()
    while (Date.now() - start < 20_000) {
      await new Promise((r) => setTimeout(r, 2000))
      router.refresh()
    }
  }

  const syncFromGoogle = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/google/sync-locations", {
        method: "POST",
        headers: withIdempotencyHeader(),
      })
      if (res.status === 401) {
        router.replace("/signin")
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? res.statusText)
      toast.success("Sync started", { description: data?.jobId ? `Job ${data.jobId}` : undefined })
      void runSyncPolling()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/locations/select", {
        method: "POST",
        headers: withIdempotencyHeader({ "content-type": "application/json" }),
        body: JSON.stringify({ enabledLocationIds: Array.from(selected) }),
      })
      if (res.status === 401) {
        router.replace("/signin")
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? res.statusText)
      toast.success("Saved", { description: data?.worker?.claimed ? `Worker claimed ${data.worker.claimed}` : undefined })
      router.refresh()
      if (mode === "onboarding") router.push("/inbox")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border border-border">
            <LayoutDashboard className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === "onboarding" ? "Choose Locations" : "Locations"}
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              Enable locations to sync and manage reviews
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-2 h-9 text-xs border-border font-semibold"
          onClick={syncFromGoogle}
          disabled={syncing}
        >
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {syncing ? "Syncing…" : "Sync from Google"}
        </Button>
      </div>

      {/* Selection bar */}
      <Card className="rounded-2xl border-border bg-card shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="rounded-md text-[11px] tabular-nums h-6 px-2.5 bg-muted text-muted-foreground font-semibold">
              {selected.size} selected
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-muted-foreground font-medium" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-xl h-8 text-xs text-muted-foreground font-medium" onClick={deselectAll}>
                Deselect all
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl h-8 text-xs gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-elevated min-w-[90px]"
                onClick={save}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-3 animate-spin" /> : null}
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location cards */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-24 w-24 bg-card shadow-sm rounded-3xl flex items-center justify-center mb-6 border border-border">
              <Search className="h-10 w-10 opacity-20" />
            </div>
            <p className="text-sm font-medium text-foreground">No locations found</p>
            <p className="text-xs text-muted-foreground mt-1.5">Try adjusting your search or sync from Google.</p>
          </div>
        ) : (
          visible.map((l, idx) => {
            const isEnabled = selected.has(l.id)

            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.15), duration: 0.25 }}
              >
                <Card
                  className={cn(
                    "rounded-2xl border-border bg-card shadow-card cursor-pointer transition-all hover:shadow-elevated",
                    isEnabled ? "border-primary/30 bg-primary/10" : ""
                  )}
                  onClick={() => toggle(l.id, !isEnabled)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={(v) => toggle(l.id, Boolean(v))}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <Avatar className="h-11 w-11 border border-border shadow-sm">
                        <AvatarFallback className={cn("font-semibold text-xs", isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          <MapPin className="size-4" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold truncate text-foreground">{l.displayName}</span>
                          {isEnabled && (
                            <Badge variant="secondary" className="rounded-md text-[9px] px-2 h-5 gap-1 bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider">
                              <CheckCircle2 className="size-2.5" /> enabled
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {l.storeCode && (
                            <>
                              <Badge variant="secondary" className="rounded-md text-[9px] font-mono h-5 px-2 bg-muted text-muted-foreground">
                                {l.storeCode}
                              </Badge>
                              <span className="text-muted-foreground/60">•</span>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground truncate font-medium">
                            {l.addressSummary ?? "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

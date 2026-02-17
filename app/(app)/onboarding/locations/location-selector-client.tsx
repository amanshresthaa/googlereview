"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useGlobalSearch } from "@/components/search-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { RefreshCw, Search, MapPin, Loader2, LayoutDashboard, CheckCircle2, ChevronRight } from "@/components/icons"
import { withIdempotencyHeader } from "@/lib/api/client-idempotency"
import { INBOX_PAGE_THEME_CLASSES } from "@/lib/design-system/inbox-theme"
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
    <div className={INBOX_PAGE_THEME_CLASSES.page}>
      {/* Header */}
      <div className={INBOX_PAGE_THEME_CLASSES.hero}>
        <div className={INBOX_PAGE_THEME_CLASSES.heroLead}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={INBOX_PAGE_THEME_CLASSES.heroIcon}
          >
            <LayoutDashboard className="size-7" />
          </motion.div>
          <div className="space-y-1">
            <h1 className={INBOX_PAGE_THEME_CLASSES.heroTitle}>
              {mode === "onboarding" ? "Select Locations" : "Managed Locations"}
            </h1>
            <p className={INBOX_PAGE_THEME_CLASSES.heroKicker}>
              Sync reviews for active business units
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="app-action-secondary h-11 w-full gap-2 rounded-xl px-6 font-bold sm:w-auto"
          onClick={syncFromGoogle}
          disabled={syncing}
        >
          {syncing ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Loader2 className="size-4" />
            </motion.div>
          ) : (
            <RefreshCw className="size-4" />
          )}
          {syncing ? "Syncing Locations…" : "Sync from Google"}
        </Button>
      </div>

      {/* Selection Control Bar */}
      <div className="sticky top-4 z-20">
        <Card className="app-surface-shell overflow-hidden rounded-[24px] border-shell-foreground/[0.08]">
          <CardContent className="flex flex-col gap-4 p-4 md:p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <motion.div
                key={selected.size}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="rounded-full border border-brand/30 bg-brand px-4 py-1.5 text-xs font-black tabular-nums text-brand-foreground shadow-lg shadow-brand/20"
              >
                {selected.size} active
              </motion.div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-shell-foreground/45">
                Selected for sync
              </div>
            </div>
            
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:gap-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="app-action-secondary h-10 rounded-xl px-4 text-xs font-bold"
                onClick={selectAll}
              >
                Select All
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="app-action-secondary h-10 rounded-xl px-4 text-xs font-bold"
                onClick={deselectAll}
              >
                Clear All
              </Button>
              <div className="mx-1 hidden h-6 w-px bg-shell-foreground/10 sm:block" />
              <Button
                type="button"
                className="app-action-primary h-10 w-full rounded-xl px-6 text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:min-w-[120px] sm:px-8"
                onClick={save}
                disabled={busy}
              >
                {busy && (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="size-4 mr-2" />
                  </motion.div>
                )}
                {busy ? "Saving…" : "Save Selection"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Grid/List */}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-shell-foreground"
          >
            <div className="relative mb-8">
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-brand/15 blur-2xl"
              />
              <div className="app-surface-shell relative flex h-24 w-24 items-center justify-center rounded-[32px] border-shell-foreground/[0.08] transition-transform hover:rotate-12">
                <Search className="h-10 w-10 text-shell-foreground/35" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-shell-foreground">No locations found</h3>
            <p className="mt-2 max-w-xs text-center text-sm font-medium text-shell-foreground/55">
              We couldn&apos;t find any locations matching your search. Try a different query or sync from Google.
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {visible.map((l, index) => {
              const isEnabled = selected.has(l.id)

              return (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={cn(
                      "app-pane-card group cursor-pointer overflow-hidden rounded-[24px] transition-all duration-300 hover:shadow-card",
                      isEnabled
                        ? "border-brand/30 bg-brand/10 ring-1 ring-brand/25"
                        : "border-shell-foreground/[0.08] hover:bg-shell-foreground/[0.035]"
                    )}
                    onClick={() => toggle(l.id, !isEnabled)}
                  >
                    <CardContent className="p-5 md:p-6">
                      <div className="flex items-start gap-4 sm:items-center sm:gap-5">
                        <div className="relative flex items-center justify-center">
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={(v) => toggle(l.id, Boolean(v))}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 rounded-lg border-2 border-shell-foreground/20 data-[state=checked]:border-brand data-[state=checked]:bg-brand transition-all shadow-sm"
                          />
                        </div>

                        <Avatar className="h-12 w-12 border-2 border-shell-foreground/[0.1] shadow-sm transition-transform group-hover:scale-110">
                          <AvatarFallback className={cn("font-black text-sm transition-colors", isEnabled ? "bg-brand/15 text-brand/80" : "bg-shell-foreground/10 text-shell-foreground/50")}>
                            <MapPin className="size-5" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="truncate text-lg font-bold text-shell-foreground transition-colors group-hover:text-brand/80">{l.displayName}</span>
                            <AnimatePresence>
                              {isEnabled && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                >
                                  <Badge className="gap-1 rounded-full border border-success/20 bg-success/20 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-success-soft shadow-sm">
                                    <CheckCircle2 className="size-3" /> Enabled
                                  </Badge>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            {l.storeCode && (
                              <div className="rounded-md border border-shell-foreground/10 bg-shell-foreground/5 px-2 py-0.5 font-mono text-[10px] font-black text-shell-foreground/60">
                                #{l.storeCode}
                              </div>
                            )}
                            <span className="truncate text-xs font-medium italic text-shell-foreground/50">
                              {l.addressSummary ?? "Address not available"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="hidden h-10 w-10 translate-x-4 items-center justify-center rounded-full bg-shell-foreground/5 text-shell-foreground/50 opacity-0 transition-all group-hover:translate-x-0 group-hover:bg-brand group-hover:text-brand-foreground group-hover:opacity-100 sm:flex">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

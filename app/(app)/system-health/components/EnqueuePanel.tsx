"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus } from "@/components/icons"
import { cn } from "@/lib/utils"

export type EnabledLocation = { id: string; displayName: string }

function OwnerGate(props: { enabled: boolean; reason: string; children: React.ReactNode }) {
  if (props.enabled) return <>{props.children}</>
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{props.children}</TooltipTrigger>
        <TooltipContent className="text-xs">{props.reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function EnqueuePanel(props: {
  isOwner: boolean
  enabledLocations: EnabledLocation[]
  loading: boolean
  onSyncLocations: () => void
  onSyncReviewsAll: () => void
  onSyncReviewsOne: (locationId: string) => void
}) {
  const [locationId, setLocationId] = React.useState<string>("")

  return (
    <Card className="app-surface-shell rounded-[24px] border-border/55 bg-card/85 p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="app-section-title">Enqueue Jobs</div>
          <div className="mt-1 text-xs text-muted-foreground font-medium">
            Owner-only operations. In-flight jobs are de-duplicated by dedupKey.
          </div>
        </div>
        <div className="app-pane-card h-8 w-8 rounded-full bg-muted/45 flex items-center justify-center">
           <Plus className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <OwnerGate enabled={props.isOwner} reason="Only OWNER can enqueue jobs.">
          <Button
            type="button"
            className="app-action-primary h-11 rounded-xl font-bold shadow-sm"
            onClick={props.onSyncLocations}
            disabled={!props.isOwner || props.loading}
          >
            Sync Locations
          </Button>
        </OwnerGate>

        <OwnerGate enabled={props.isOwner} reason="Only OWNER can enqueue jobs.">
          <Button
            type="button"
            variant="secondary"
            className="app-action-secondary h-11 rounded-xl font-bold shadow-sm"
            onClick={props.onSyncReviewsAll}
            disabled={!props.isOwner || props.loading}
          >
            Sync Reviews (All Enabled)
          </Button>
        </OwnerGate>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-11 w-full rounded-xl border-border/55 bg-background font-medium shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-[320px]">
            <SelectValue placeholder="Sync one location (optional)" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {props.enabledLocations.length ? (
              props.enabledLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.displayName}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__none" disabled>
                No enabled locations
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <OwnerGate enabled={props.isOwner} reason="Only OWNER can enqueue jobs.">
          <Button
            type="button"
            variant="secondary"
            className={cn("app-action-secondary h-11 w-full rounded-xl border-border/50 font-bold shadow-sm sm:w-auto", "sm:whitespace-nowrap")}
            onClick={() => {
              if (!locationId) return
              props.onSyncReviewsOne(locationId)
            }}
            disabled={!props.isOwner || props.loading || !locationId}
          >
            Sync Reviews (Selected)
          </Button>
        </OwnerGate>
      </div>
    </Card>
  )
}

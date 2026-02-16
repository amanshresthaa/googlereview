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
    <Card className="rounded-[24px] p-6 shadow-sm border-border/50 bg-background">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-bold text-foreground">Enqueue Jobs</div>
          <div className="mt-1 text-xs text-muted-foreground font-medium">
            Owner-only operations. In-flight jobs are de-duplicated by dedupKey.
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
           <Plus className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <OwnerGate enabled={props.isOwner} reason="Only OWNER can enqueue jobs.">
          <Button
            type="button"
            className="rounded-xl h-11 font-bold shadow-sm"
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
            className="rounded-xl h-11 font-bold shadow-sm"
            onClick={props.onSyncReviewsAll}
            disabled={!props.isOwner || props.loading}
          >
            Sync Reviews (All Enabled)
          </Button>
        </OwnerGate>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="h-11 w-full rounded-xl font-medium shadow-sm sm:w-[320px]">
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
            className={cn("h-11 w-full rounded-xl font-bold shadow-sm sm:w-auto", "sm:whitespace-nowrap")}
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

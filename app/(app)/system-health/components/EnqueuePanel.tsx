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
    <Card className="rounded-xl p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold">Enqueue Jobs</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Owner-only operations. In-flight jobs are de-duplicated by dedupKey.
          </div>
        </div>
        <Plus className="size-4 text-muted-foreground" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <OwnerGate enabled={props.isOwner} reason="Only OWNER can enqueue jobs.">
          <Button
            type="button"
            className="rounded-lg"
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
            className="rounded-lg"
            onClick={props.onSyncReviewsAll}
            disabled={!props.isOwner || props.loading}
          >
            Sync Reviews (All Enabled)
          </Button>
        </OwnerGate>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="rounded-lg sm:w-[320px]">
            <SelectValue placeholder="Sync one location (optional)" />
          </SelectTrigger>
          <SelectContent>
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
            className={cn("rounded-lg", "sm:whitespace-nowrap")}
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


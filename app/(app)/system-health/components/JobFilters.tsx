"use client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Filter, Search, X } from "@/components/icons"
import { cn } from "@/lib/utils"

export type FilterOption = {
  value: string
  label: string
}

function countSelected(selected: Set<string>) {
  return selected.size
}

function hasAny(selected: Set<string>) {
  return selected.size > 0
}

export function JobFilters(props: {
  q: string
  onQChange: (q: string) => void
  statusOptions: FilterOption[]
  selectedStatuses: Set<string>
  onToggleStatus: (value: string) => void
  typeOptions: FilterOption[]
  selectedTypes: Set<string>
  onToggleType: (value: string) => void
  onReset: () => void
}) {
  const hasFilters = hasAny(props.selectedStatuses) || hasAny(props.selectedTypes) || Boolean(props.q)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-[340px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={props.q}
            onChange={(e) => props.onQChange(e.target.value)}
            placeholder="Filter by job id or dedupKey…"
            className="h-10 rounded-xl border-border/55 bg-background pl-9 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="app-action-secondary h-10 w-full justify-between rounded-xl border-border/55 bg-muted/40 px-3 sm:w-auto sm:justify-start">
              <Filter className="size-4" />
              <span className="ml-2">Status</span>
              {countSelected(props.selectedStatuses) ? (
                <Badge variant="secondary" className="ml-2 rounded-md bg-background/75 px-2 py-0 text-[10px] font-black">
                  {countSelected(props.selectedStatuses)}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-xl border-border/60 bg-card/95">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {props.statusOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={props.selectedStatuses.has(opt.value)}
                onCheckedChange={() => props.onToggleStatus(opt.value)}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="app-action-secondary h-10 w-full justify-between rounded-xl border-border/55 bg-muted/40 px-3 sm:w-auto sm:justify-start">
              <Filter className="size-4" />
              <span className="ml-2">Type</span>
              {countSelected(props.selectedTypes) ? (
                <Badge variant="secondary" className="ml-2 rounded-md bg-background/75 px-2 py-0 text-[10px] font-black">
                  {countSelected(props.selectedTypes)}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl border-border/60 bg-card/95">
            <DropdownMenuLabel>Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {props.typeOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={props.selectedTypes.has(opt.value)}
                onCheckedChange={() => props.onToggleType(opt.value)}
              >
                <span className={cn("font-mono text-[12px]")}>{opt.value}</span>
                <span className="ml-2 text-muted-foreground text-xs">{opt.label}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        type="button"
        variant="ghost"
        className={cn("app-action-secondary h-10 w-full justify-start rounded-xl border border-transparent px-3 sm:w-auto sm:justify-center", !hasFilters && "opacity-50")}
        onClick={props.onReset}
        disabled={!hasFilters}
      >
        <X className="size-4" />
        <span className="ml-2">Reset</span>
      </Button>
    </div>
  )
}

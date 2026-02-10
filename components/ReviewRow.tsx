"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock } from "lucide-react"
import { formatAge, type ReviewRow as ReviewRowType } from "@/lib/hooks"

type Props = {
  row: ReviewRowType
  isSelected: boolean
  showCheckbox: boolean
  isChecked: boolean
  onSelect: () => void
  onCheck: (checked: boolean) => void
}

function StarDots({ rating }: { rating: number }) {
  const color =
    rating <= 2 ? "bg-red-500" : rating === 3 ? "bg-amber-500" : "bg-emerald-600"
  const emptyColor = "bg-stone-200"

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={cn(
            "inline-block size-2 rounded-full",
            s <= rating ? color : emptyColor
          )}
        />
      ))}
    </div>
  )
}

function DraftStatusBadge({
  status,
  unanswered,
}: {
  status: string | null
  unanswered: boolean
}) {
  if (!unanswered) {
    return (
      <Badge variant="outline" className="text-stone-500 text-[10px]">
        Replied
      </Badge>
    )
  }

  switch (status) {
    case "READY":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px]">
          Ready
        </Badge>
      )
    case "BLOCKED_BY_VERIFIER":
      return (
        <Badge className="bg-amber-100 text-amber-700 border-none text-[10px]">
          Blocked
        </Badge>
      )
    case "NEEDS_APPROVAL":
      return (
        <Badge className="bg-sky-100 text-sky-700 border-none text-[10px]">
          Needs Review
        </Badge>
      )
    case "POST_FAILED":
      return (
        <Badge className="bg-red-100 text-red-700 border-none text-[10px]">
          Failed
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-stone-500 text-[10px]">
          No Draft
        </Badge>
      )
  }
}

export function ReviewRow({
  row,
  isSelected,
  showCheckbox,
  isChecked,
  onSelect,
  onCheck,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors border-l-3 hover:bg-stone-50",
        isSelected
          ? "border-l-emerald-600 bg-emerald-50/40"
          : "border-l-transparent"
      )}
    >
      {showCheckbox && (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onCheck(e.target.checked)}
            className="accent-emerald-600 size-4 rounded border-stone-300"
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <StarDots rating={row.starRating} />
          <DraftStatusBadge status={row.draftStatus} unanswered={row.unanswered} />
        </div>

        <p className="text-sm text-stone-700 line-clamp-2 leading-snug">
          {row.snippet || "No comment"}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-400">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{row.location.displayName}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="size-3" />
            {formatAge(row.createTimeIso)}
          </span>
        </div>

        {row.mentions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {row.mentions.map((m) => (
              <span
                key={m}
                className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

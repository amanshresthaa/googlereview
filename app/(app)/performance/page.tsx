import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getPerformanceSidebarData } from "@/lib/sidebar-data"
import { BarChart, CheckCircle2, Sparkles, Star } from "@/components/icons"

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export default async function PerformancePage() {
  const session = await getSession()
  if (!session?.user?.id || !session.orgId) redirect("/signin")

  const { summary, aiDraftedInRange } = await getPerformanceSidebarData(session.orgId)

  const aiContribution =
    summary.kpis.totalReviews > 0 ? aiDraftedInRange / summary.kpis.totalReviews : 0

  return (
    <div className="max-w-6xl mx-auto p-10 space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatItem
          label="Response Rate"
          value={formatPct(summary.kpis.replyRate)}
          trend={`${summary.kpis.totalReviews} reviews`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="blue"
        />
        <StatItem
          label="Avg Rating"
          value={summary.kpis.avgRating.toFixed(1)}
          trend={`Flagged ${summary.kpis.flaggedClaims}`}
          icon={<Star className="h-5 w-5" />}
          color="yellow"
        />
        <StatItem
          label="AI Contribution"
          value={formatPct(aiContribution)}
          trend={`${aiDraftedInRange} drafted`}
          icon={<Sparkles className="h-5 w-5" />}
          color="indigo"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm h-[400px] flex items-center justify-center text-zinc-400">
        <div className="text-center">
          <BarChart className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Response Trend ({summary.range.days} days)</p>
          <p className="text-sm opacity-60">
            {summary.series.daily.reduce((sum, d) => sum + d.replied, 0)} replies posted in current window
          </p>
        </div>
      </div>
    </div>
  )
}

function StatItem({
  label,
  value,
  trend,
  icon,
  color,
}: {
  label: string
  value: string
  trend: string
  icon: ReactNode
  color: "blue" | "yellow" | "indigo"
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
    indigo: "bg-indigo-50 text-indigo-600",
  } as const

  return (
    <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-full">
          {trend}
        </span>
      </div>
      <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-zinc-900">{value}</p>
    </div>
  )
}

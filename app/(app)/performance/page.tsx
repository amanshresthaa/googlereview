import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getPerformanceSidebarData } from "@/lib/sidebar-data"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
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
        <StatItem
          label="SEO Coverage"
          value={formatPct(summary.kpis.avgSeoKeywordCoverage)}
          trend={`${summary.kpis.seoStuffingRiskCount} stuffing risks`}
          icon={<Sparkles className="h-5 w-5" />}
          color="blue"
        />
        <StatItem
          label="AI Block Rate"
          value={formatPct(summary.kpis.aiBlockedRate)}
          trend={`${formatPct(summary.kpis.requiredKeywordUsageRate)} keyword usage`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="yellow"
        />
      </div>

      <Card className="border-zinc-200 rounded-3xl shadow-sm h-[400px] flex items-center justify-center text-zinc-400">
        <CardContent className="text-center p-8">
          <BarChart className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Response Trend ({summary.range.days} days)</p>
          <p className="text-sm opacity-60">
            {summary.series.daily.reduce((sum, d) => sum + d.replied, 0)} replies posted in current window
          </p>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 rounded-3xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">DSPy Program Quality</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-600">
            Active program:{" "}
            <span className="font-mono text-zinc-900">
              {summary.dspy.activeProgramVersion ?? "unknown"}
            </span>
          </p>
          {summary.dspy.programVersions.length ? (
            <div className="space-y-2">
              {summary.dspy.programVersions.map((item) => (
                <div
                  key={`${item.version}:${item.draftArtifactVersion}:${item.verifyArtifactVersion}`}
                  className="rounded-xl border border-zinc-200 p-3"
                >
                  <p className="text-xs font-semibold text-zinc-700">
                    <span className="font-mono">{item.version}</span> · {item.runs} runs
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Blocked: {formatPct(item.blockedRate)} · Coverage: {formatPct(item.avgKeywordCoverage)} · Required keyword usage: {formatPct(item.requiredKeywordUsageRate)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No DSPy runs in the selected range.</p>
          )}
        </CardContent>
      </Card>
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
    <Card className="border-zinc-200 rounded-2xl shadow-sm">
      <CardHeader className="p-6 pb-3">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
          <Badge variant="secondary" className="text-xs font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-full border-transparent">
            {trend}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <p className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
        <CardTitle className="text-3xl font-black text-zinc-900">{value}</CardTitle>
      </CardContent>
    </Card>
  )
}

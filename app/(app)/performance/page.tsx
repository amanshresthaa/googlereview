import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getPerformanceSummary, type PerformanceSummary } from "@/lib/performance"
import { PerformanceClient } from "./performance-client"
import { BarChart } from "@/components/icons"

export default async function PerformancePage() {
  const sess = await getSession()
  if (!sess) redirect("/signin")

  let summary: PerformanceSummary | null = null
  try {
    summary = await getPerformanceSummary({ orgId: sess.orgId, days: 30 })
  } catch {
    // no data yet
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="h-24 w-24 bg-card shadow-card rounded-3xl flex items-center justify-center mb-6 border border-border">
          <BarChart className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-semibold text-foreground">No performance data yet</p>
        <p className="text-xs text-muted-foreground mt-1.5">Enable locations to start tracking.</p>
      </div>
    )
  }

  return <PerformanceClient summary={summary} />
}

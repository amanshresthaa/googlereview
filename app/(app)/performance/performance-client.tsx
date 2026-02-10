"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Star,
    TrendingUp,
    MessageSquare,
    ShieldCheck,
    AlertTriangle,
    BarChart,
    ArrowUp,
    ArrowDown,
    CheckCircle2,
    Clock,
    Eye,
    Sparkles,
} from "@/components/icons"
import type { PerformanceSummary, PerformanceDailyPoint } from "@/lib/performance"

/* ─── Animation Variants ─── */

const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
}

/* ─── Helpers ─── */

function formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
}

function getMonthDay(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/* ─── KPI Card ─── */

type KpiCardProps = {
    title: string
    value: string
    subtitle?: string
    icon: React.ElementType
    iconBg: string
    iconColor: string
    trend?: { value: string; direction: "up" | "down" | "neutral" }
    sparkline?: number[]
}

function KpiCard({ title, value, subtitle, icon: Icon, iconBg, iconColor, trend, sparkline }: KpiCardProps) {
    return (
        <motion.div variants={fadeUp}>
            <Card className="rounded-2xl border-border bg-card shadow-card hover:shadow-elevated transition-all duration-300 group">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">{title}</div>
                            <div className="text-3xl font-extrabold text-foreground tabular-nums tracking-tight leading-none">{value}</div>
                            {subtitle && <div className="text-xs text-muted-foreground font-medium">{subtitle}</div>}
                            {trend && (
                                <div className={cn(
                                    "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md",
                                    trend.direction === "up" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                                        trend.direction === "down" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" :
                                            "bg-muted text-muted-foreground"
                                )}>
                                    {trend.direction === "up" ? <ArrowUp className="h-2.5 w-2.5" /> : trend.direction === "down" ? <ArrowDown className="h-2.5 w-2.5" /> : null}
                                    {trend.value}
                                </div>
                            )}
                        </div>
                        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105", iconBg)}>
                            <Icon className={cn("h-5 w-5", iconColor)} />
                        </div>
                    </div>

                    {/* Sparkline */}
                    {sparkline && sparkline.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/60">
                            <MiniSparkline data={sparkline} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}

/* ─── Mini Sparkline ─── */

function MiniSparkline({ data }: { data: number[] }) {
    const max = Math.max(1, ...data)
    const points = data.map((v, i) => {
        const x = (i / Math.max(1, data.length - 1)) * 100
        const y = 100 - (v / max) * 100
        return `${x},${y}`
    }).join(" ")

    return (
        <svg
            viewBox="0 0 100 30"
            className="w-full h-6"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
        >
            <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className="text-primary"
                vectorEffect="non-scaling-stroke"
            />
            <polygon
                fill="url(#spark-grad)"
                points={`0,30 ${points} 100,30`}
                className="text-primary"
            />
        </svg>
    )
}

/* ─── Bar Chart ─── */

function ReviewVolumeChart({ data }: { data: PerformanceDailyPoint[] }) {
    const maxVal = Math.max(1, ...data.map(d => d.reviews))
    const [hovered, setHovered] = React.useState<number | null>(null)

    // Show every Nth label based on data length
    const labelEvery = data.length > 21 ? 5 : data.length > 14 ? 3 : data.length > 7 ? 2 : 1

    return (
        <motion.div variants={fadeUp}>
            <Card className="rounded-2xl border-border bg-card shadow-card">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                                <BarChart className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <span className="text-sm font-bold text-foreground">Review Volume</span>
                                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Daily incoming reviews & replies</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-5 text-[10px] font-semibold text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-2 w-2 rounded-[3px] bg-primary" /> Reviews
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-2 w-2 rounded-[3px] bg-emerald-500" /> Replied
                            </span>
                        </div>
                    </div>

                    {/* Grid lines */}
                    <div className="relative">
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height: "160px" }}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-2 w-full">
                                    <span className="text-[8px] tabular-nums text-muted-foreground/50 font-medium w-6 text-right shrink-0">
                                        {Math.round(maxVal * (1 - i / 3))}
                                    </span>
                                    <div className="flex-1 border-t border-dashed border-border/60" />
                                </div>
                            ))}
                        </div>

                        {/* Bars */}
                        <div className="flex items-end gap-[3px] pl-8" style={{ height: "160px" }}>
                            {data.map((d, idx) => {
                                const reviewH = Math.max(3, (d.reviews / maxVal) * 100)
                                const repliedH = d.reviews > 0 ? Math.max(0, (d.replied / maxVal) * 100) : 0
                                const isHovered = hovered === idx

                                 return (
                                     <button
                                         key={d.dayIso}
                                         type="button"
                                         className="flex-1 flex flex-col items-center gap-1 relative cursor-pointer bg-transparent border-0 p-0"
                                         onMouseEnter={() => setHovered(idx)}
                                         onMouseLeave={() => setHovered(null)}
                                         onFocus={() => setHovered(idx)}
                                         onBlur={() => setHovered(null)}
                                         onKeyDown={(e) => {
                                             if (e.key === "Escape") setHovered(null)
                                         }}
                                         aria-label={`${getMonthDay(d.dayIso)}: ${d.reviews} reviews, ${d.replied} replied`}
                                     >
                                         {/* Tooltip */}
                                         {isHovered && (
                                             <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 bg-foreground text-background text-[10px] rounded-lg px-3 py-2 shadow-floating whitespace-nowrap font-medium pointer-events-none">
                                                 <div className="font-bold">{getMonthDay(d.dayIso)}</div>
                                                 <div className="flex items-center gap-3 mt-0.5">
                                                     <span>{d.reviews} reviews</span>
                                                     <span>{d.replied} replied</span>
                                                 </div>
                                                 <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-foreground rounded-[1px]" />
                                             </div>
                                         )}

                                         <div className="w-full flex-1 flex items-end justify-center gap-[1px]" style={{ height: "100%" }}>
                                             <div
                                                 className={cn(
                                                     "w-[42%] rounded-t-sm transition-all duration-200",
                                                     isHovered ? "bg-primary" : "bg-primary/50"
                                                 )}
                                                 style={{ height: `${reviewH}%` }}
                                             />
                                             <div
                                                 className={cn(
                                                     "w-[42%] rounded-t-sm transition-all duration-200",
                                                     isHovered ? "bg-emerald-500" : "bg-emerald-500/50"
                                                 )}
                                                 style={{ height: `${repliedH}%` }}
                                             />
                                         </div>
                                     </button>
                                 )
                             })}
                         </div>

                        {/* X-axis labels */}
                        <div className="flex gap-[3px] pl-8 mt-2">
                            {data.map((d, idx) => (
                                <div key={d.dayIso} className="flex-1 text-center">
                                    {idx % labelEvery === 0 && (
                                        <span className="text-[7px] text-muted-foreground/60 font-medium tabular-nums">
                                            {d.dayIso.slice(5)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

/* ─── Rating Distribution ─── */

function RatingBreakdown({ avgRating, totalReviews }: { avgRating: number; totalReviews: number }) {
    // Derive star distribution from daily data
    // Since we don't have per-star breakdown, we'll show the overall score prominently
    const pct = totalReviews > 0 ? (avgRating / 5) * 100 : 0

    return (
        <motion.div variants={fadeUp}>
            <Card className="rounded-2xl border-border bg-card shadow-card h-full">
                <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center border border-amber-200 dark:border-amber-500/30">
                            <Star className="h-4 w-4 text-amber-600 dark:text-amber-400" weight="fill" />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-foreground">Rating Overview</span>
                            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Customer satisfaction score</div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center">
                        {/* Big rating circle */}
                        <div className="relative mb-4">
                            <svg viewBox="0 0 120 120" className="w-32 h-32" aria-hidden="true" focusable="false">
                                {/* Background circle */}
                                <circle
                                    cx="60" cy="60" r="52"
                                    fill="none"
                                    className="stroke-border"
                                    strokeWidth="8"
                                />
                                {/* Filled circle */}
                                <circle
                                    cx="60" cy="60" r="52"
                                    fill="none"
                                    className="stroke-amber-400"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${(pct / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                                    transform="rotate(-90 60 60)"
                                    style={{ transition: "stroke-dasharray 1s ease" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-extrabold text-foreground tabular-nums">{avgRating.toFixed(1)}</span>
                                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">out of 5</span>
                            </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                    key={n}
                                    weight={n <= Math.round(avgRating) ? "fill" : "regular"}
                                    className={cn(
                                        "h-4 w-4",
                                        n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                                    )}
                                />
                            ))}
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">
                            Based on <span className="font-bold text-foreground">{totalReviews}</span> reviews
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

/* ─── Activity Heatmap Strip ─── */

function ActivityStrip({ data }: { data: PerformanceDailyPoint[] }) {
    const max = Math.max(1, ...data.map(d => d.reviews))
    const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null)

    return (
        <motion.div variants={fadeUp}>
            <Card className="rounded-2xl border-border bg-card shadow-card">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center border border-purple-200 dark:border-purple-500/30">
                                <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <span className="text-sm font-bold text-foreground">Daily Activity</span>
                                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Review activity heatmap</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-medium">
                            <span>Less</span>
                            <div className="flex gap-[2px]">
                                {[0, 0.25, 0.5, 0.75, 1].map((level) => (
                                    <div
                                        key={String(level)}
                                        className="h-3 w-3 rounded-[3px]"
                                        style={{
                                            backgroundColor: level === 0
                                                ? "var(--border)"
                                                : `oklch(0.55 0.24 262 / ${0.2 + level * 0.8})`
                                        }}
                                    />
                                ))}
                            </div>
                            <span>More</span>
                        </div>
                    </div>

                    <div className="flex gap-[3px]">
                        {data.map((d, idx) => {
                            const intensity = d.reviews / max
                            const isHovered = hoveredIdx === idx

                            return (
                                <button
                                    key={d.dayIso}
                                    type="button"
                                    className="flex-1 relative bg-transparent border-0 p-0"
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    onFocus={() => setHoveredIdx(idx)}
                                    onBlur={() => setHoveredIdx(null)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") setHoveredIdx(null)
                                    }}
                                    aria-label={`${getMonthDay(d.dayIso)}: ${d.reviews} reviews`}
                                >
                                    <div
                                        className={cn(
                                            "w-full aspect-square rounded-[4px] transition-all duration-200 cursor-pointer",
                                            isHovered && "ring-2 ring-primary/40 scale-125 z-10"
                                        )}
                                        style={{
                                            backgroundColor: d.reviews === 0
                                                ? "var(--border)"
                                                : `oklch(0.55 0.24 262 / ${0.15 + intensity * 0.85})`
                                        }}
                                    />
                                    {isHovered && (
                                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 bg-foreground text-background text-[9px] rounded-lg px-2.5 py-1.5 shadow-floating whitespace-nowrap font-medium pointer-events-none">
                                            <div className="font-bold">{getMonthDay(d.dayIso)}</div>
                                            <div>{d.reviews} review{d.reviews !== 1 ? "s" : ""}</div>
                                            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-1.5 h-1.5 rotate-45 bg-foreground rounded-[1px]" />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

/* ─── Quick Stats Row ─── */

function QuickStats({ kpis, daily }: { kpis: PerformanceSummary["kpis"]; daily: PerformanceDailyPoint[] }) {
    const totalReplied = daily.reduce((s, d) => s + d.replied, 0)
    const totalFlagged = daily.reduce((s, d) => s + d.flagged, 0)
    const avgPerDay = daily.length > 0 ? (kpis.totalReviews / daily.length).toFixed(1) : "0"
    const bestDay = daily.reduce((best, d) => d.reviews > best.reviews ? d : best, daily[0])

    const stats = [
        { label: "Avg per day", value: avgPerDay, icon: Clock },
        { label: "Total replied", value: totalReplied.toString(), icon: CheckCircle2 },
        { label: "Best day", value: bestDay ? getMonthDay(bestDay.dayIso) : "—", icon: TrendingUp },
        { label: "Flagged", value: totalFlagged.toString(), icon: totalFlagged > 0 ? AlertTriangle : ShieldCheck },
    ]

    return (
        <motion.div variants={fadeUp}>
            <Card className="rounded-2xl border-border bg-card shadow-card">
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
                        {stats.map((s) => (
                            <div key={s.label} className="p-5 flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                    <s.icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{s.label}</div>
                                    <div className="text-sm font-extrabold text-foreground tabular-nums">{s.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

/* ─── Main Component ─── */

export function PerformanceClient({ summary }: { summary: PerformanceSummary }) {
    const { kpis, series } = summary
    const replyPercent = (kpis.replyRate * 100).toFixed(0)

    // Build sparkline data for review counts
    const reviewSparkline = series.daily.map(d => d.reviews)
    const ratingSparkline = series.daily.map(d => d.avgRating ?? 0)

    return (
        <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
        >
            {/* Header */}
            <motion.div variants={fadeUp} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border border-border">
                        <Sparkles className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Insights</h1>
                        <p className="text-sm font-medium text-muted-foreground mt-0.5">Last {summary.range.days} days performance overview</p>
                    </div>
                </div>
                <Badge variant="secondary" className="rounded-xl px-4 py-2 text-xs font-bold bg-muted text-muted-foreground tabular-nums">
                    {summary.range.days} days
                </Badge>
            </motion.div>

            {/* KPI Grid */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Avg Rating"
                    value={kpis.avgRating.toFixed(1)}
                    icon={Star}
                    iconBg="bg-amber-100 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30"
                    iconColor="text-amber-600 dark:text-amber-400"
                    trend={kpis.avgRating >= 4.0 ? { value: "Good", direction: "up" } : { value: "Needs attention", direction: "down" }}
                    sparkline={ratingSparkline}
                />
                <KpiCard
                    title="Total Reviews"
                    value={formatNumber(kpis.totalReviews)}
                    icon={MessageSquare}
                    iconBg="bg-primary/10 border border-primary/20"
                    iconColor="text-primary"
                    sparkline={reviewSparkline}
                />
                <KpiCard
                    title="Reply Rate"
                    value={`${replyPercent}%`}
                    icon={TrendingUp}
                    iconBg="bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                    trend={Number(replyPercent) >= 80 ? { value: "On track", direction: "up" } : { value: "Below target", direction: "down" }}
                />
                <KpiCard
                    title="Flagged"
                    value={kpis.flaggedClaims.toString()}
                    subtitle="Blocked by verifier"
                    icon={kpis.flaggedClaims > 0 ? AlertTriangle : ShieldCheck}
                    iconBg={kpis.flaggedClaims > 0
                        ? "bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30"
                        : "bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30"
                    }
                    iconColor={kpis.flaggedClaims > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
                />
            </div>

            {/* Quick Stats */}
            <QuickStats kpis={kpis} daily={series.daily} />

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <ReviewVolumeChart data={series.daily} />
                </div>
                <div>
                    <RatingBreakdown avgRating={kpis.avgRating} totalReviews={kpis.totalReviews} />
                </div>
            </div>

            {/* Activity Heatmap */}
            <ActivityStrip data={series.daily} />
        </motion.div>
    )
}

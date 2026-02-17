/**
 * page-theme.ts — Generalized page-level class recipe system.
 *
 * This module provides composable, typed class contracts for page layouts.
 * It replaces the need for ad-hoc Tailwind class strings across page components
 * and ensures visual consistency across all app routes.
 *
 * Architecture:
 *   PAGE_THEME   — shared classes used by every page
 *   INBOX_THEME  — inbox-specific overrides (re-exported from inbox-theme.ts)
 *
 * Usage:
 *   import { PAGE_THEME } from "@/lib/design-system/page-theme"
 *   <div className={PAGE_THEME.page}>…</div>
 */

/* ─────────────────────────────────────────────────────────
   Shared page-level class contracts
   ───────────────────────────────────────────────────────── */
export const PAGE_THEME = {
    /* Page root */
    page: "app-container space-y-8 py-4 sm:py-6 lg:py-10",

    /* ── Hero / page header ── */
    hero: "flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between",
    heroLead: "flex items-center gap-5",
    heroIcon:
        "flex h-14 w-14 items-center justify-center rounded-2xl border border-shell-foreground/10 bg-shell-foreground/5 text-brand-muted shadow-floating motion-all motion-standard",
    heroTitle:
        "bg-gradient-to-b from-shell-foreground to-shell-foreground/60 bg-clip-text text-2xl font-black tracking-tight text-transparent md:text-3xl",
    heroKicker: "type-kicker text-shell-foreground/40",
    heroDescription: "type-body text-shell-foreground/60 max-w-prose",

    /* ── Tabs (page-level nav) ── */
    tabList:
        "inline-flex h-12 w-full items-center justify-start gap-1 overflow-x-auto rounded-2xl border border-shell-foreground/10 bg-shell-foreground/5 p-1.5 sm:w-auto",
    tabTrigger:
        "h-9 shrink-0 rounded-xl border border-transparent px-5 text-xs font-black uppercase tracking-[0.14em] text-shell-foreground/70 motion-all motion-standard data-[state=active]:border-shell-foreground/10 data-[state=active]:bg-shell-foreground/10 data-[state=active]:text-shell-foreground/90 data-[state=active]:shadow-sm",

    /* ── Toolbar (action bar below tabs) ── */
    toolbar:
        "app-surface-shell flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between",
    toolbarSection: "flex items-center gap-2",
    toolbarDivider: "hidden h-6 w-px bg-shell-foreground/10 sm:block",

    /* ── Metric cards ── */
    metricCard: "app-surface-shell rounded-[24px] p-6",
    metricLabel: "type-kicker text-shell-foreground/40",
    metricValue: "mt-2 text-4xl font-black tabular-nums text-shell-foreground/90",
    metricDelta: "type-caption text-shell-foreground/50",
    metricGrid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",

    /* ── Section containers ── */
    section: "space-y-4",
    sectionHeader: "flex items-center justify-between",
    sectionTitle: "type-section text-shell-foreground/85",
    sectionKicker: "type-kicker text-shell-foreground/40",
    sectionDescription: "type-body text-shell-foreground/55 max-w-prose",
    sectionCard: "app-surface-shell rounded-2xl p-6 space-y-6",

    /* ── Data table container ── */
    tableContainer: "app-surface-shell overflow-hidden rounded-2xl",
    tableHeader: "border-b border-shell-foreground/10 px-6 py-4 flex items-center justify-between",
    tableHeaderTitle: "type-body font-bold text-shell-foreground/80",

    /* ── Filter / segmented controls ── */
    filterRow: "flex flex-wrap items-center gap-2",
    filterPill:
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 type-kicker motion-all motion-fast active:scale-95",
    filterPillActive:
        "border-brand/30 bg-brand/15 text-brand-muted",
    filterPillIdle:
        "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70 hover:bg-shell-foreground/10",

    /* ── Form fields ── */
    fieldGroup: "space-y-5",
    fieldLabel: "type-kicker text-shell-foreground/50",
    fieldDescription: "type-caption text-shell-foreground/45",

    /* ── Action footer (sticky bottom bar) ── */
    actionFooter:
        "sticky bottom-0 z-20 border-t border-shell-foreground/10 bg-shell-elevated/80 backdrop-blur-xl px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl",

    /* ── Empty / error / loading states ── */
    emptyContainer: "py-16",
} as const

/* ─────────────────────────────────────────────────────────
   Helper: dynamically compose a filter pill class
   ───────────────────────────────────────────────────────── */
export function filterPillClass(active: boolean) {
    return active
        ? `${PAGE_THEME.filterPill} ${PAGE_THEME.filterPillActive}`
        : `${PAGE_THEME.filterPill} ${PAGE_THEME.filterPillIdle}`
}

/* ─────────────────────────────────────────────────────────
   Helper: metric delta direction
   ───────────────────────────────────────────────────────── */
export function metricDeltaClass(direction: "up" | "down" | "neutral") {
    const base = PAGE_THEME.metricDelta
    switch (direction) {
        case "up":
            return `${base} text-success`
        case "down":
            return `${base} text-destructive`
        default:
            return base
    }
}

/* ─────────────────────────────────────────────────────────
   Status class helper (shared across pages)
   ───────────────────────────────────────────────────────── */
export type StatusVariant =
    | "pending"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "blocked"
    | "ready"

const STATUS_MAP: Record<StatusVariant, string> = {
    pending: "border-state-pending-border bg-state-pending-bg text-state-pending-fg",
    success: "border-state-ready-border bg-state-ready-bg text-state-ready-fg",
    ready: "border-state-ready-border bg-state-ready-bg text-state-ready-fg",
    warning: "border-state-needs-edit-border bg-state-needs-edit-bg text-state-needs-edit-fg",
    error: "border-state-error-border bg-state-error-bg text-state-error-fg",
    info: "border-state-posted-border bg-state-posted-bg text-state-posted-fg",
    blocked: "border-state-blocked-border bg-state-blocked-bg text-state-blocked-fg",
}

export function statusClass(variant: StatusVariant) {
    return `rounded-full border px-2.5 py-0.5 type-kicker ${STATUS_MAP[variant]}`
}

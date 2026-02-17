/**
 * inbox-theme.ts — Inbox-specific class recipe layer.
 *
 * This module extends the shared PAGE_THEME with inbox-specific contracts.
 * Import PAGE_THEME for shared patterns, INBOX_THEME_CLASSES for inbox-only.
 *
 * Re-exports PAGE_THEME and helpers for convenience so inbox pages
 * can import everything from one place.
 */

export { PAGE_THEME, filterPillClass, statusClass } from "./page-theme"
export type { StatusVariant } from "./page-theme"

export const INBOX_THEME_CLASSES = {
  frame:
    "relative flex h-full min-h-0 overflow-hidden bg-shell text-shell-foreground font-sans selection:bg-brand/30",
  workspace:
    "relative flex min-h-0 flex-1 overflow-hidden",

  feedPane:
    "min-h-0 flex-1 flex flex-col overflow-hidden",
  feedListSection: "relative flex h-full min-h-0 flex-col",
  feedListInner: "space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6 lg:px-12 lg:py-8",
  detailPane:
    "min-h-0 flex-1 border-l border-shell-foreground/10 bg-shell-foreground/5 backdrop-blur-xl",

  headerSection:
    "relative px-6 py-6 lg:px-12 lg:pt-12 lg:pb-8",
  headerAccentRail:
    "hidden",
  headerPendingPill:
    "inline-flex min-w-6 items-center justify-center rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-2.5 py-0.5 type-kicker tabular-nums text-shell-foreground/70",
  iconButton:
    "h-10 w-10 rounded-xl border border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70 motion-all motion-slow hover:bg-shell-foreground/10 hover:text-shell-foreground/90 active:scale-95",
  searchInput:
    "h-11 rounded-2xl border-shell-foreground/10 bg-shell-foreground/5 pl-10 type-body text-shell-foreground/90 placeholder:text-shell-foreground/40 motion-all motion-slow focus-visible:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/20",
  segmented: "flex items-center gap-2 overflow-x-auto pb-2",
  segmentedButton: "whitespace-nowrap rounded-full border px-5 py-2 type-kicker transition-all",
  segmentedButtonActive:
    "border-shell-foreground/15 bg-shell-foreground/10 text-shell-foreground/90",
  segmentedButtonIdle: "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70 hover:bg-shell-foreground/10",

  statusPending:
    "rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 type-kicker text-warning-soft",
  statusReplied:
    "rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 type-kicker text-success-soft",
  draftBadge:
    "inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/15 px-2.5 py-0.5 type-kicker text-brand-muted",
  quickApproveEnabled:
    "border-brand/35 bg-brand text-brand-foreground shadow-lg shadow-brand/20 hover:bg-brand-soft",
  quickApproveIdle:
    "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70 hover:bg-shell-foreground/10",

  detailLocationChip:
    "inline-flex items-center gap-1.5 rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-3 py-1 type-kicker text-shell-foreground/70",
  detailBackButton:
    "mb-4 h-9 rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-3 text-shell-foreground/70 motion-all motion-slow hover:bg-shell-foreground/10 hover:text-shell-foreground/90",

  actionIslandWrap:
    "pointer-events-none absolute inset-x-3 bottom-4 z-30 pb-[calc(env(safe-area-inset-bottom)+2px)] md:inset-x-8",
  actionIsland:
    "pointer-events-auto rounded-[24px] border border-shell-foreground/10 bg-shell-foreground/5 p-4 text-shell-foreground/90 shadow-2xl backdrop-blur-xl",
  islandSecondary:
    "h-10 rounded-xl border border-shell-foreground/10 bg-shell-foreground/5 px-3 type-kicker tracking-wider text-shell-foreground/80 motion-all motion-slow hover:bg-shell-foreground/10 active:scale-95",
  islandPrimary:
    "h-11 rounded-2xl bg-brand px-5 text-[13px] font-bold text-brand-foreground shadow-lg shadow-brand/20 motion-all motion-slow hover:bg-brand-soft active:scale-[0.97]",
  islandSuccess: "flex items-center justify-center gap-2 text-success-soft",

  filterSection:
    "border-t border-shell-foreground/10 bg-transparent px-6 pb-4 pt-3 lg:px-12",
  filterToggle:
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 type-kicker motion-all motion-slow active:scale-95",
  filterToggleActive:
    "border-brand/30 bg-brand/15 text-brand-muted",
  filterToggleIdle:
    "border-shell-foreground/10 bg-shell-foreground/5 text-shell-foreground/70 hover:bg-shell-foreground/10",
  filterActivePill:
    "inline-flex h-8 items-center gap-1 rounded-full border border-brand/30 bg-brand/15 px-2.5 type-kicker text-brand-muted",
  filterSelectTrigger:
    "h-9 min-w-[110px] rounded-full border-shell-foreground/10 bg-shell-foreground/5 px-3 text-[11px] font-medium text-shell-foreground/70",
  filterResetButton:
    "shrink-0 rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-3 py-1.5 type-kicker text-shell-foreground/70 motion-all motion-slow hover:bg-shell-foreground/10 hover:text-shell-foreground/90",
  bulkApproveActive:
    "h-9 rounded-full border border-brand/35 bg-brand px-4 type-kicker text-brand-foreground shadow-lg shadow-brand/20 motion-all motion-slow hover:bg-brand-soft",
  bulkApproveIdle:
    "h-9 rounded-full border border-shell-foreground/10 bg-shell-foreground/5 px-4 type-kicker text-shell-foreground/70 motion-all motion-slow hover:bg-shell-foreground/10",

  listLoadMoreButton:
    "h-10 w-full rounded-full border border-shell-foreground/10 bg-shell-foreground/5 type-kicker text-shell-foreground/70 motion-all motion-slow hover:bg-shell-foreground/10 hover:text-shell-foreground/90",
} as const

export const INBOX_PAGE_THEME_CLASSES = {
  page: "app-container space-y-8 py-4 sm:py-6 lg:py-10",
  hero: "flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between",
  heroLead: "flex items-center gap-5",
  heroIcon:
    "flex h-14 w-14 items-center justify-center rounded-2xl border border-shell-foreground/10 bg-shell-foreground/5 text-brand-muted shadow-floating",
  heroTitle:
    "bg-gradient-to-b from-shell-foreground to-shell-foreground/60 bg-clip-text text-2xl font-black tracking-tight text-transparent md:text-3xl",
  heroKicker: "type-kicker text-shell-foreground/40",
  tabList:
    "inline-flex h-12 w-full items-center justify-start gap-1 overflow-x-auto rounded-2xl border border-shell-foreground/10 bg-shell-foreground/5 p-1.5 sm:w-auto",
  tabTrigger:
    "h-9 shrink-0 rounded-xl border border-transparent px-5 type-kicker tracking-[0.14em] font-black text-shell-foreground/70 motion-all motion-standard data-[state=active]:border-shell-foreground/10 data-[state=active]:bg-shell-foreground/10 data-[state=active]:text-shell-foreground/90 data-[state=active]:shadow-sm",
  toolbar:
    "app-surface-shell flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between",
  metricCard: "app-surface-shell rounded-[24px] p-6",
  metricLabel: "type-kicker text-shell-foreground/40",
  metricValue: "mt-2 text-4xl font-black tabular-nums text-shell-foreground/90",
} as const

export function inboxStatusClass(status: "pending" | "replied") {
  return status === "pending" ? INBOX_THEME_CLASSES.statusPending : INBOX_THEME_CLASSES.statusReplied
}

export function inboxSegmentedClass(active: boolean) {
  return active
    ? `${INBOX_THEME_CLASSES.segmentedButton} ${INBOX_THEME_CLASSES.segmentedButtonActive}`
    : `${INBOX_THEME_CLASSES.segmentedButton} ${INBOX_THEME_CLASSES.segmentedButtonIdle}`
}

export function inboxGoogleDotClass(index: number) {
  const STATUS_DOT_CLASSES = ["bg-brand", "bg-destructive", "bg-warning", "bg-success"] as const
  const normalized = ((index % STATUS_DOT_CLASSES.length) + STATUS_DOT_CLASSES.length) % STATUS_DOT_CLASSES.length
  return STATUS_DOT_CLASSES[normalized]
}

export function inboxStarClass(filled: boolean) {
  return filled ? "fill-star text-star" : "fill-shell-foreground/10 text-shell-foreground/10"
}

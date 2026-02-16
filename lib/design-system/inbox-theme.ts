export const INBOX_THEME_CLASSES = {
  frame:
    "relative flex h-full min-h-0 overflow-hidden rounded-[34px] border border-white/45 bg-white/40 p-2 shadow-[0_28px_80px_rgba(15,23,42,0.22)] tahoe-pane-l1 md:p-3",
  workspace:
    "relative flex min-h-0 flex-1 gap-2 overflow-hidden rounded-[30px] bg-white/10 p-2 tahoe-canvas",

  feedPane: "min-h-0 rounded-[28px] border border-white/45 bg-white/20 tahoe-pane-l2",
  feedListSection: "relative flex h-full min-h-0 flex-col",
  feedListInner: "space-y-2 px-2 py-2 md:space-y-3 md:px-3 md:py-3",
  detailPane: "min-h-0 flex-1 rounded-[28px] border border-white/45 bg-white/30 tahoe-pane-l3",

  headerSection:
    "rounded-[22px] border border-white/50 bg-white/30 px-3 pb-3 pt-3.5 tahoe-pane-l3 md:px-4 md:pb-3.5 md:pt-4",
  searchInput:
    "h-11 rounded-2xl border-white/55 bg-white/55 pl-10 text-sm font-medium text-slate-700 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300 focus-visible:border-[#007AFF]/35 focus-visible:ring-2 focus-visible:ring-[#007AFF]/25",
  segmented: "rounded-2xl border border-white/55 bg-white/35 p-1 backdrop-blur-xl",
  segmentedButton: "h-8 rounded-xl text-[11px] font-black uppercase tracking-[0.12em]",
  segmentedButtonActive:
    "bg-white/85 text-[#007AFF] shadow-[0_6px_18px_rgba(15,23,42,0.14)]",
  segmentedButtonIdle: "text-slate-500 hover:bg-white/45 hover:text-slate-800",

  statusPending:
    "rounded-full border border-orange-200/60 bg-orange-100/65 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.11em] text-orange-700",
  statusReplied:
    "rounded-full border border-emerald-200/60 bg-emerald-100/65 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.11em] text-emerald-700",
  draftBadge:
    "inline-flex items-center gap-1 rounded-full border border-[#007AFF]/30 bg-[#007AFF]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#007AFF]",
  quickApproveEnabled:
    "bg-black/90 text-white hover:bg-black disabled:hover:bg-black/90",
  quickApproveIdle:
    "bg-white/60 text-slate-500 hover:bg-white/80",

  detailLocationChip:
    "inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#007AFF] tahoe-pane-l3",
  detailBackButton:
    "mb-3 h-9 rounded-full border border-white/60 bg-white/70 px-3 text-[#007AFF] transition-all duration-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#007AFF]/30",

  actionIslandWrap:
    "pointer-events-none absolute inset-x-3 bottom-4 z-30 pb-[calc(env(safe-area-inset-bottom)+2px)] md:inset-x-8",
  actionIsland:
    "pointer-events-auto rounded-[32px] border border-white/20 bg-black/90 p-3 text-white shadow-[0_24px_50px_rgba(2,6,23,0.5)] tahoe-action-island",
  islandSecondary:
    "h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white/85 transition-all duration-300 hover:bg-white/20 active:scale-95",
  islandPrimary:
    "h-11 rounded-2xl border border-white/20 bg-[#007AFF] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(0,122,255,0.4)] transition-all duration-300 hover:bg-[#006ae0] active:scale-[0.97]",
  islandSuccess: "flex items-center justify-center gap-2 text-emerald-300",
} as const

export function inboxStatusClass(status: "pending" | "replied") {
  return status === "pending" ? INBOX_THEME_CLASSES.statusPending : INBOX_THEME_CLASSES.statusReplied
}

export function inboxSegmentedClass(active: boolean) {
  return active
    ? `${INBOX_THEME_CLASSES.segmentedButton} ${INBOX_THEME_CLASSES.segmentedButtonActive}`
    : `${INBOX_THEME_CLASSES.segmentedButton} ${INBOX_THEME_CLASSES.segmentedButtonIdle}`
}

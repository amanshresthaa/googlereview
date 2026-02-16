export const INBOX_THEME_TOKENS = {
  color: {
    shell: "#f2f2f7",
    panel: "#ffffff",
    panelMuted: "#f7f7fb",
    border: "#e2e8f0",
    borderStrong: "#cbd5e1",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    accent: "#007aff",
    accentSoft: "#eef3ff",
    success: "#0ea5e9",
    warning: "#f59e0b",
    chatBg: "#f7f7f8",
    bubbleUser: "#ffffff",
    bubbleAi: "#f7f7f8",
  },
  radius: {
    shell: "1.75rem",
    panel: "1.25rem",
    control: "1rem",
    chip: "0.5rem",
    island: "1.75rem",
  },
  shadow: {
    shell: "0 20px 60px rgba(15, 23, 42, 0.12)",
    card: "inset 0 0 0 1px rgba(0, 0, 0, 0.03)",
    island: "0 20px 50px rgba(0, 0, 0, 0.14)",
  },
  typography: {
    title: "text-2xl md:text-3xl font-black tracking-tight",
    reviewer: "text-3xl md:text-5xl font-black tracking-tight",
    body: "text-sm md:text-base font-medium leading-relaxed",
    quote: "text-xl md:text-[28px] font-semibold leading-[1.4] tracking-tight",
    micro: "text-[10px] font-black uppercase tracking-[0.14em]",
  },
  motion: {
    fast: "duration-200",
    base: "duration-300",
    slow: "duration-500",
  },
} as const

export const INBOX_THEME_CLASSES = {
  frame: "flex h-full min-h-0 overflow-hidden bg-[#f7f7f8] p-2 md:p-4",
  workspace:
    "flex min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)]",
  feedPane: "min-h-0 border-r border-slate-200/70 bg-white",
  feedListSection: "relative flex h-full min-h-0 flex-col bg-white",
  feedListInner: "px-2 py-2 md:px-3 md:py-3",
  feedLoadMoreButton: "h-10 w-full rounded-xl border-slate-200 bg-white",
  detailPane: "min-h-0 flex-1 bg-white",

  headerSection: "border-b border-slate-200/70 px-3 pb-3 pt-4",
  iconPill: "grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-[#007aff] shadow-sm",
  searchInput:
    "h-11 rounded-2xl border-slate-200 bg-[#f2f2f7] pl-10 text-sm font-semibold placeholder:text-slate-400",
  segmented: "rounded-2xl border border-slate-200 bg-white p-1",
  segmentedButton: "h-8 rounded-xl text-xs font-bold tracking-tight",
  segmentedButtonActive: "bg-[#f2f2f7] text-[#007aff] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]",
  segmentedButtonIdle: "text-slate-500 hover:text-slate-800",

  filterSection: "border-t border-slate-200/70 px-3 pb-3 pt-2",
  filterSurface:
    "rounded-2xl border border-slate-200/80 bg-[#f7f7fb] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
  filterControl: "h-9 rounded-xl border-slate-200 bg-white text-xs font-semibold",

  feedCard: "group relative mb-1.5 cursor-pointer rounded-2xl p-4 transition-all duration-300 active:scale-[0.99]",
  feedCardSelected: "bg-[#eef3ff] shadow-[inset_0_0_0_1px_rgba(0,122,255,0.12)]",
  feedCardIdle: "bg-white hover:bg-slate-50",
  statusPending: "rounded-md border border-orange-200/70 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-orange-600 shadow-sm",
  statusReplied: "rounded-md border border-blue-200/70 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight text-blue-600 shadow-sm",
  draftBadge: "inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-tight text-blue-600",
  quickApproveEnabled: "bg-black text-white hover:bg-slate-800",
  quickApproveIdle: "bg-slate-100 text-slate-400",

  detailCanvas: "relative flex h-full min-h-0 flex-col bg-[#f7f7f8]",
  detailContainer: "mx-auto w-full max-w-4xl px-6 pb-48 pt-6 md:px-10 md:pt-10",
  detailLocationChip:
    "inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#007aff]",
  detailBackButton: "mb-4 -ml-2 h-8 rounded-full px-2 text-[#007aff]",
  quote: "text-xl font-semibold leading-[1.4] tracking-tight text-slate-800 md:text-[28px]",
  draftArea:
    "min-h-[260px] rounded-3xl border-none px-0 text-[18px] font-medium leading-relaxed text-slate-700 shadow-none outline-none ring-0 placeholder:text-slate-300 focus-visible:ring-0",
  repliedDraftSurface: "min-h-[220px] rounded-3xl border border-blue-100 bg-blue-50/40 p-6",

  actionIslandWrap: "pointer-events-none absolute inset-x-4 bottom-5 z-30 md:inset-x-10",
  actionIsland:
    "rounded-[28px] border border-white/60 bg-white/85 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.14)] backdrop-blur-2xl",
  islandSecondary: "h-10 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-500",
  islandPrimary: "h-12 rounded-2xl bg-black px-5 text-sm font-black text-white hover:bg-slate-800",
  islandSuccess: "flex items-center justify-center gap-2 text-[#007aff]",

  messageBubbleUser:
    "rounded-2xl bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]",
  messageBubbleAi:
    "rounded-2xl bg-[#f7f7f8] px-5 py-4",
  messageAvatar:
    "grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100",
  composerBar:
    "sticky bottom-0 z-30 mx-auto w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl",
  composerTextarea:
    "min-h-[44px] w-full resize-none rounded-xl border-none bg-transparent px-3 py-2.5 text-sm font-medium leading-relaxed text-slate-800 shadow-none outline-none ring-0 placeholder:text-slate-400 focus-visible:ring-0",
  composerButton:
    "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600",
} as const

export function inboxStatusClass(status: "pending" | "replied") {
  return status === "pending" ? INBOX_THEME_CLASSES.statusPending : INBOX_THEME_CLASSES.statusReplied
}

export function inboxSegmentedClass(active: boolean) {
  return active
    ? `${INBOX_THEME_CLASSES.segmentedButton} ${INBOX_THEME_CLASSES.segmentedButtonActive}`
    : `${INBOX_THEME_CLASSES.segmentedButton} ${INBOX_THEME_CLASSES.segmentedButtonIdle}`
}

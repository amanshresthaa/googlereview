export default function AppSectionLoading() {
  return (
    <div className="p-6 md:p-10 space-y-8">
      <div className="space-y-3">
        <div className="h-10 w-48 rounded-2xl bg-muted" />
        <div className="h-4 w-80 rounded-lg bg-muted/60" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="h-32 rounded-[24px] bg-card border border-border/50 shadow-sm" />
        <div className="h-32 rounded-[24px] bg-card border border-border/50 shadow-sm" />
        <div className="h-32 rounded-[24px] bg-card border border-border/50 shadow-sm" />
      </div>

      <div className="h-[400px] rounded-[32px] bg-card border border-border/50 shadow-sm" />
    </div>
  )
}


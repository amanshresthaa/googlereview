export default function AppSectionLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-muted" />
      <div className="h-4 w-64 rounded bg-muted/60" />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
        <div className="h-28 rounded-2xl bg-card border border-border shadow-card" />
        <div className="h-28 rounded-2xl bg-card border border-border shadow-card" />
        <div className="h-28 rounded-2xl bg-card border border-border shadow-card" />
      </div>

      <div className="h-80 rounded-2xl bg-card border border-border shadow-card" />
    </div>
  )
}

export default function AppSectionLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-zinc-200" />
      <div className="h-4 w-64 rounded bg-zinc-100" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="h-28 rounded-2xl bg-white border border-zinc-200" />
        <div className="h-28 rounded-2xl bg-white border border-zinc-200" />
        <div className="h-28 rounded-2xl bg-white border border-zinc-200" />
      </div>

      <div className="h-80 rounded-2xl bg-white border border-zinc-200" />
    </div>
  )
}

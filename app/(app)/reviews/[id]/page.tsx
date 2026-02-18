type ReviewDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const { id } = await params
  return (
    <main className="app-container py-10">
      <h1 className="text-2xl font-black tracking-tight">Review Detail</h1>
      <p className="mt-2 text-sm text-shell-foreground/60">Review ID: {id}</p>
      <p className="mt-1 text-sm text-shell-foreground/60">Use the inbox split-view for full triage and reply workflows.</p>
    </main>
  )
}

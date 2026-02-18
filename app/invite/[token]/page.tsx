type InvitePageProps = {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  return (
    <main className="app-container py-10">
      <h1 className="text-2xl font-black tracking-tight">Invitation</h1>
      <p className="mt-2 text-sm text-shell-foreground/60">Invite token: {token}</p>
    </main>
  )
}

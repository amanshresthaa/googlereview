"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

type Settings = {
  tonePreset: string
  toneCustomInstructions: string | null
  autoDraftEnabled: boolean
  autoDraftForRatings: number[]
  bulkApproveEnabledForFiveStar: boolean
  aiProvider: "OPENAI" | "GEMINI"
  mentionKeywords: string[]
}

type MemberRow = {
  userId: string
  email: string
  name: string | null
  role: string
}

type InviteRow = {
  id: string
  email: string
  role: string
  expiresAtIso: string
}

export function SettingsClient(props: {
  settings: Settings
  members: MemberRow[]
  invites: InviteRow[]
  isOwner: boolean
}) {
  const router = useRouter()
  const [s, setS] = React.useState(props.settings)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<"STAFF" | "MANAGER" | "OWNER">("STAFF")
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null)

  async function updateSettings() {
    setBusy("save")
    setError(null)
    setInviteUrl(null)
    try {
      const res = await fetch("/api/settings/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tonePreset: s.tonePreset,
          toneCustomInstructions: s.toneCustomInstructions,
          autoDraftEnabled: s.autoDraftEnabled,
          autoDraftForRatings: s.autoDraftForRatings,
          bulkApproveEnabledForFiveStar: s.bulkApproveEnabledForFiveStar,
          aiProvider: s.aiProvider,
          mentionKeywords: s.mentionKeywords,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function createInvite() {
    setBusy("invite")
    setError(null)
    setInviteUrl(null)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as { inviteUrl: string }
      setInviteUrl(json.inviteUrl)
      setInviteEmail("")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function revokeInvite(inviteId: string) {
    setBusy("revoke")
    setError(null)
    setInviteUrl(null)
    try {
      const res = await fetch("/api/team/invite/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="text-sm font-semibold">Tone</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Preset</div>
            <Input
              value={s.tonePreset}
              onChange={(e) => setS((p) => ({ ...p, tonePreset: e.target.value }))}
              placeholder="friendly"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <div className="text-muted-foreground text-xs">Custom instructions</div>
            <Textarea
              value={s.toneCustomInstructions ?? ""}
              onChange={(e) => setS((p) => ({ ...p, toneCustomInstructions: e.target.value || null }))}
              rows={4}
              placeholder="Optional extra instructions for the AI..."
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold">Automation</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.autoDraftEnabled}
            onChange={(e) => setS((p) => ({ ...p, autoDraftEnabled: e.target.checked }))}
          />
          Auto-create a draft when a new review arrives
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.bulkApproveEnabledForFiveStar}
            onChange={(e) => setS((p) => ({ ...p, bulkApproveEnabledForFiveStar: e.target.checked }))}
          />
          Enable bulk approve for 5★ replies
        </label>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold">AI Provider</div>
        <div className="flex flex-wrap gap-2">
          {(["OPENAI", "GEMINI"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={[
                "border-border rounded-full border px-3 py-1 text-sm",
                s.aiProvider === p
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-muted/50",
              ].join(" ")}
              onClick={() => setS((prev) => ({ ...prev, aiProvider: p }))}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="text-muted-foreground text-xs">
          Ensure the corresponding API key is configured in server environment variables.
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold">Mentions</div>
        <div className="text-muted-foreground text-xs">
          These keywords power the Inbox “Mentions” filters and evidence highlighting.
        </div>
        <Textarea
          value={s.mentionKeywords.join("\n")}
          onChange={(e) =>
            setS((prev) => ({
              ...prev,
              mentionKeywords: e.target.value
                .split("\n")
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean),
            }))
          }
          rows={6}
          placeholder={"cold\nwait\nrude"}
        />
      </section>

      <div className="flex items-center gap-2">
        <Button onClick={updateSettings} disabled={busy !== null}>
          {busy === "save" ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Team</div>
          {props.isOwner ? <Badge variant="secondary">Owner</Badge> : <Badge variant="secondary">Member</Badge>}
        </div>

        <div className="divide-border rounded-md border">
          {props.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{m.email}</div>
                <div className="text-muted-foreground text-xs">
                  {m.name || "—"} · {m.role}
                </div>
              </div>
            </div>
          ))}
        </div>

        {props.isOwner ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Invite member</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="person@company.com"
                className="sm:col-span-2"
              />
              <select
                value={inviteRole}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "STAFF" || v === "MANAGER" || v === "OWNER") {
                    setInviteRole(v)
                  }
                }}
                className="border-border bg-background text-foreground rounded-md border px-3 py-2 text-sm"
              >
                <option value="STAFF">STAFF</option>
                <option value="MANAGER">MANAGER</option>
                <option value="OWNER">OWNER</option>
              </select>
            </div>
            <Button onClick={createInvite} disabled={busy !== null || !inviteEmail.trim()}>
              {busy === "invite" ? "Creating..." : "Create invite link"}
            </Button>
            {inviteUrl ? (
              <div className="border-border bg-muted/30 rounded-md border p-3 text-sm">
                Invite link: <span className="font-mono">{inviteUrl}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {props.invites.length ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">Active invites</div>
            <div className="divide-border rounded-md border">
              {props.invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{i.email}</div>
                    <div className="text-muted-foreground text-xs">
                      {i.role} · expires {new Date(i.expiresAtIso).toLocaleString()}
                    </div>
                  </div>
                  {props.isOwner ? (
                    <Button
                      variant="ghost"
                      onClick={() => revokeInvite(i.id)}
                      disabled={busy !== null}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

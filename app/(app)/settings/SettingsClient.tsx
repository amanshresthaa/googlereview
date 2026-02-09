"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

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

  const roleItems = [
    { value: "STAFF", label: "Staff" },
    { value: "MANAGER", label: "Manager" },
    { value: "OWNER", label: "Owner" },
  ]

  return (
    <div className="space-y-4">
      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-medium">Tone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tone-preset" className="text-xs">Preset</Label>
            <Input
              id="tone-preset"
              value={s.tonePreset}
              onChange={(e) => setS((p) => ({ ...p, tonePreset: e.target.value }))}
              placeholder="friendly"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tone-instructions" className="text-xs">Custom instructions</Label>
            <Textarea
              id="tone-instructions"
              value={s.toneCustomInstructions ?? ""}
              onChange={(e) => setS((p) => ({ ...p, toneCustomInstructions: e.target.value || null }))}
              rows={4}
              placeholder="Optional extra instructions for the AI..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-medium">Automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={s.autoDraftEnabled}
              onChange={(e) => setS((p) => ({ ...p, autoDraftEnabled: e.target.checked }))}
              className="accent-primary h-4 w-4"
            />
            Auto-create a draft when a new review arrives
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={s.bulkApproveEnabledForFiveStar}
              onChange={(e) => setS((p) => ({ ...p, bulkApproveEnabledForFiveStar: e.target.checked }))}
              className="accent-primary h-4 w-4"
            />
            Enable bulk approve for 5★ replies
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-medium">AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border-border inline-flex rounded-md border">
            {(["OPENAI", "GEMINI"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={[
                  "px-4 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md",
                  s.aiProvider === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                ].join(" ")}
                onClick={() => setS((prev) => ({ ...prev, aiProvider: p }))}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Ensure the corresponding API key is configured in server environment variables.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] font-medium">Keywords</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-xs">
            These keywords power the Inbox &ldquo;Mentions&rdquo; filters and evidence highlighting.
          </p>
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
        </CardContent>
      </Card>

      <Button
        onClick={updateSettings}
        disabled={busy !== null}
        className="w-full sm:w-auto"
      >
        {busy === "save" ? "Saving..." : "Save settings"}
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[13px] font-medium">Team</CardTitle>
            <Badge variant="secondary" className="text-[11px]">
              {props.isOwner ? "Owner" : "Member"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-border rounded-md border">
            {props.members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 p-3">
                <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase">
                  {m.email.charAt(0)}
                </div>
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
            <div className="space-y-3">
              <Label className="text-sm font-medium">Invite member</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="person@company.com"
                  className="sm:col-span-2"
                />
                <Select
                  value={inviteRole}
                  onValueChange={(val) => {
                    if (val === "STAFF" || val === "MANAGER" || val === "OWNER") {
                      setInviteRole(val)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createInvite} disabled={busy !== null || !inviteEmail.trim()}>
                {busy === "invite" ? "Creating..." : "Create invite link"}
              </Button>
              {inviteUrl ? (
                <div className="border-border bg-muted/30 space-y-1 rounded-md border p-3">
                  <p className="text-muted-foreground text-xs font-medium">Invite link</p>
                  <div className="bg-background break-all rounded border p-2 font-mono text-sm">
                    {inviteUrl}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {props.invites.length ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Active invites</Label>
              <div className="space-y-2">
                {props.invites.map((i) => (
                  <div
                    key={i.id}
                    className="border-border flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{i.email}</div>
                      <div className="text-muted-foreground text-xs">
                        {i.role} · expires {new Date(i.expiresAtIso).toLocaleString()}
                      </div>
                    </div>
                    {props.isOwner ? (
                      <Button
                        variant="destructive"
                        size="sm"
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
        </CardContent>
      </Card>
    </div>
  )
}

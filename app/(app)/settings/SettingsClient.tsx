"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle, Plus, Trash2, Copy, Check, Loader2,
  Settings2, Zap, MessageSquare, Users, Activity, Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

type Settings = {
  tonePreset: string
  toneCustomInstructions: string | null
  autoDraftEnabled: boolean
  autoDraftForRatings: number[]
  bulkApproveEnabledForFiveStar: boolean
  aiProvider: "OPENAI" | "GEMINI"
  mentionKeywords: string[]
}

type MemberRow = { userId: string; email: string; name: string | null; role: string }
type InviteRow = { id: string; email: string; role: string; expiresAtIso: string }

export function SettingsClient(props: {
  settings: Settings
  members: MemberRow[]
  invites: InviteRow[]
  isOwner: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") || "general"
  const [activeTab, setActiveTab] = React.useState(initialTab)

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab) setActiveTab(tab)
  }, [searchParams])

  const [s, setS] = React.useState(props.settings)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<"STAFF" | "MANAGER" | "OWNER">("STAFF")
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  async function updateSettings() {
    setBusy("save"); setError(null); setInviteUrl(null)
    try {
      const res = await fetch("/api/settings/update", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tonePreset: s.tonePreset, toneCustomInstructions: s.toneCustomInstructions,
          autoDraftEnabled: s.autoDraftEnabled, autoDraftForRatings: s.autoDraftForRatings,
          bulkApproveEnabledForFiveStar: s.bulkApproveEnabledForFiveStar,
          aiProvider: s.aiProvider, mentionKeywords: s.mentionKeywords,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  async function createInvite() {
    setBusy("invite"); setError(null); setInviteUrl(null)
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as { inviteUrl: string }
      setInviteUrl(json.inviteUrl); setInviteEmail(""); router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  async function revokeInvite(inviteId: string) {
    setBusy("revoke"); setError(null); setInviteUrl(null)
    try {
      const res = await fetch("/api/team/invite/revoke", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const roleItems = [
    { value: "STAFF", label: "Staff" },
    { value: "MANAGER", label: "Manager" },
    { value: "OWNER", label: "Owner" },
  ]

  const tabs = [
    { id: "general", label: "General", icon: Settings2 },
    { id: "automation", label: "Automation", icon: Zap },
    { id: "ai-tone", label: "AI Tone", icon: MessageSquare },
    { id: "team", label: "Team", icon: Users },
  ]

  return (
    <div className="max-w-6xl">
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex gap-3 text-destructive text-sm items-center">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-48 space-y-1 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id} type="button"
                onClick={() => { setActiveTab(tab.id); router.replace(`/settings?tab=${tab.id}`) }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            )
          })}

          <Separator className="my-3" />
          <Link
            href="/inbox"
            className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <Activity size={16} /> System Health
          </Link>
        </div>

        <div className="flex-grow space-y-6">
          {activeTab === "general" && (
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-1">General Settings</h3>
                  <p className="text-sm text-muted-foreground">Configure core application behavior.</p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-sm font-medium">AI Provider</Label>
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    {(["OPENAI", "GEMINI"] as const).map((p) => (
                      <button
                        key={p} type="button"
                        onClick={() => setS((prev) => ({ ...prev, aiProvider: p }))}
                        className={`cursor-pointer p-4 border rounded-xl flex items-center justify-between transition-all ${
                          s.aiProvider === p
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <span className={`text-sm font-medium ${s.aiProvider === p ? "text-primary" : "text-foreground"}`}>{p}</span>
                        {s.aiProvider === p && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Ensure the API key is set in environment variables.</p>
                </div>
                <div className="pt-4">
                  <Button onClick={updateSettings} disabled={busy !== null}>
                    {busy === "save" ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "automation" && (
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-1">Automation</h3>
                  <p className="text-sm text-muted-foreground">Manage automated workflows and triggers.</p>
                </div>
                <Separator />
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto-Draft</Label>
                      <p className="text-sm text-muted-foreground">Automatically generate a draft when a new review is received.</p>
                    </div>
                    <Switch checked={s.autoDraftEnabled} onCheckedChange={(checked) => setS((p) => ({ ...p, autoDraftEnabled: checked }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Bulk Approve 5★</Label>
                      <p className="text-sm text-muted-foreground">Enable bulk approval for 5-star reviews with ready drafts.</p>
                    </div>
                    <Switch checked={s.bulkApproveEnabledForFiveStar} onCheckedChange={(checked) => setS((p) => ({ ...p, bulkApproveEnabledForFiveStar: checked }))} />
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={updateSettings} disabled={busy !== null}>
                    {busy === "save" ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "ai-tone" && (
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-1">AI Tone & Behavior</h3>
                  <p className="text-sm text-muted-foreground">Control how the AI writes responses.</p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tone-preset">Tone Preset</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {["friendly", "professional", "concise", "witty"].map((t) => (
                        <button
                          key={t} type="button"
                          className={`p-3 border rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                            s.tonePreset === t
                              ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                              : "border-border hover:border-primary/30 text-muted-foreground"
                          }`}
                          onClick={() => setS((p) => ({ ...p, tonePreset: t }))}
                        >
                          <span className="text-sm font-medium capitalize">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tone-instructions">Custom Instructions</Label>
                    <Textarea
                      id="tone-instructions"
                      value={s.toneCustomInstructions ?? ""}
                      onChange={(e) => setS((p) => ({ ...p, toneCustomInstructions: e.target.value || null }))}
                      rows={4}
                      placeholder="E.g. Always sign off with '- The Team at [Location Name]'"
                      className="bg-muted/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mention Keywords</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Keywords to highlight in reviews and filter by (one per line).
                    </p>
                    <Textarea
                      value={s.mentionKeywords.join("\n")}
                      onChange={(e) =>
                        setS((prev) => ({
                          ...prev,
                          mentionKeywords: e.target.value.split("\n").map((x) => x.trim().toLowerCase()).filter(Boolean),
                        }))
                      }
                      rows={4}
                      placeholder={"cold\nwait\nrude"}
                      className="bg-muted/50 border-border"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={updateSettings} disabled={busy !== null}>
                    {busy === "save" ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {activeTab === "team" && (
            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg mb-1">Team Members</h3>
                    <p className="text-sm text-muted-foreground">Manage access to your organization.</p>
                  </div>
                  <Badge variant="secondary">{props.isOwner ? "You are Owner" : "You are Member"}</Badge>
                </div>
                <Separator />

                <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {props.members.map((m) => (
                    <div key={m.userId} className="flex items-center gap-3 p-4 bg-card">
                      <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase">
                        {m.email.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <div className="text-sm font-medium">{m.email}</div>
                        <div className="text-muted-foreground text-xs">{m.name || "—"} · {m.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {props.isOwner && (
                  <div className="pt-6 border-t border-border space-y-4">
                    <h4 className="font-medium text-sm">Invite New Member</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com" className="flex-grow"
                      />
                      <Select value={inviteRole} onValueChange={(val) => {
                        if (val === "STAFF" || val === "MANAGER" || val === "OWNER") setInviteRole(val)
                      }}>
                        <SelectTrigger className="w-32"><SelectValue placeholder="Role" /></SelectTrigger>
                        <SelectContent>
                          {roleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={createInvite} disabled={busy !== null || !inviteEmail.trim()}>
                        {busy === "invite" ? <Loader2 className="animate-spin size-4" /> : <Plus className="size-4 mr-2" />}
                        Invite
                      </Button>
                    </div>

                    {inviteUrl && (
                      <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-primary font-medium text-sm">
                          <Check size={16} /> Invite Created
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-grow bg-card border border-primary/20 rounded px-3 py-2 text-xs font-mono text-primary break-all">
                            {inviteUrl}
                          </code>
                          <Button
                            size="icon" variant="ghost"
                            className="shrink-0 text-primary hover:bg-primary/10"
                            onClick={() => handleCopy(inviteUrl)}
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {props.invites.length > 0 && (
                  <div className="pt-6 border-t border-border space-y-4">
                    <h4 className="font-medium text-sm">Pending Invites</h4>
                    <div className="space-y-2">
                      {props.invites.map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 bg-muted/50">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{i.email}</div>
                            <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                              <span>{i.role}</span>
                              <span>·</span>
                              <Clock size={12} />
                              <span>Expires {new Date(i.expiresAtIso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                          </div>
                          {props.isOwner && (
                            <Button variant="ghost" size="sm" onClick={() => revokeInvite(i.id)} disabled={busy !== null}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 size={14} className="mr-1" /> Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

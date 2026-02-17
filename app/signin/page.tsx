"use client"

import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, ShieldCheck, Sparkles, MessageSquare } from "@/components/icons"
import { cn } from "@/lib/utils"

export default function SignInPage() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-shell p-4">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-brand/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-success/10 blur-[120px]" />
      </div>

      <div className="bg-auth-dot-grid pointer-events-none absolute inset-0 opacity-[0.06]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative z-10"
      >
        <Card className="app-surface-shell overflow-hidden rounded-[40px] shadow-2xl">
          <CardContent className="p-8 md:p-12">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[24px] bg-brand text-brand-foreground shadow-lg shadow-brand/25">
              <MapPin className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h1 className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-3xl font-black tracking-tighter text-transparent md:text-4xl">ReplyAI</h1>
              <p className="text-sm font-semibold uppercase tracking-widest text-shell-foreground/40">Review Intelligence</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-shell-foreground/10 bg-shell-foreground/5 p-6 text-center text-sm font-medium leading-relaxed text-shell-foreground/70 md:text-base">
            The intelligent layer for your <span className="font-bold text-foreground">Google Business Profile</span>. Automate drafting, verify claims, and boost local SEO.
          </div>

          <div className="mt-10">
            <Button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/inbox" })}
              className="flex h-16 w-full items-center justify-center gap-4 rounded-[20px] bg-brand text-lg font-black text-brand-foreground shadow-lg shadow-brand/20 motion-safe:hover:scale-[1.02] hover:bg-brand-soft active:scale-[0.98]"
            >
              <svg className="size-6" viewBox="0 0 48 48" fill="none" role="img" aria-label="Google">
                <title>Google</title>
                <path d="M47.532 24.553c0-1.632-.132-3.272-.414-4.877H24.48v9.242h12.963a11.089 11.089 0 0 1-4.804 7.27l7.766 6.028c4.543-4.19 7.127-10.365 7.127-17.663Z" fill="currentColor" className="opacity-100" />
                <path d="M24.48 48.002c6.502 0 11.964-2.148 15.946-5.834l-7.766-6.028c-2.148 1.44-4.903 2.28-8.174 2.28-6.28 0-11.597-4.242-13.498-9.947l-7.968 6.14c3.95 7.862 12.074 13.389 21.466 13.389Z" fill="currentColor" className="opacity-80" />
                <path d="M10.982 28.473a14.44 14.44 0 0 1 0-8.954l-7.968-6.14A24.01 24.01 0 0 0 .412 24.001c0 3.87.924 7.534 2.602 10.622l7.968-6.15Z" fill="currentColor" className="opacity-60" />
                <path d="M24.48 9.571c3.44-.054 6.758 1.248 9.28 3.604l6.934-6.934C36.396 2.304 30.61.002 24.48.002 15.088.002 6.964 5.53 3.014 13.379l7.968 6.14c1.9-5.7 7.218-9.948 13.498-9.948Z" fill="currentColor" className="opacity-40" />
              </svg>
              Sign in with Google
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-4">
            {[
              { icon: Sparkles, label: "AI Drafting", color: "border-brand/20 bg-brand/10 text-brand-muted" },
              { icon: ShieldCheck, label: "Claim Verify", color: "border-success/20 bg-success/10 text-success-soft" },
              { icon: MessageSquare, label: "Smart Inbox", color: "border-info/20 bg-info/10 text-info" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-3">
                <div className={cn("backdrop-blur-sm h-12 w-12 rounded-2xl flex items-center justify-center", item.color)}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-wider text-shell-foreground/40">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-shell-foreground/40">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure Enterprise Authentication
          </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

"use client"

import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { MapPin, ShieldCheck, Sparkles, MessageSquare } from "@/components/icons"

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="rounded-3xl border border-border shadow-floating bg-card p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elevated">
              <MapPin className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground tracking-tight">Business Profile</div>
              <div className="text-sm font-medium text-muted-foreground">Review Manager</div>
            </div>
          </div>

          <div className="rounded-2xl bg-muted/60 border border-border p-5 text-sm text-muted-foreground leading-relaxed font-medium">
            Sign in to manage reviews, verify AI drafts, and keep all your locations synced.
          </div>

          <div className="mt-8 space-y-4">
            <Button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/inbox" })}
              className="w-full rounded-2xl bg-primary hover:bg-primary/90 h-14 text-base font-semibold shadow-elevated text-primary-foreground transition-colors flex items-center justify-center gap-3"
            >
              <svg className="size-5" viewBox="0 0 48 48" fill="none">
                <path d="M47.532 24.553c0-1.632-.132-3.272-.414-4.877H24.48v9.242h12.963a11.089 11.089 0 0 1-4.804 7.27l7.766 6.028c4.543-4.19 7.127-10.365 7.127-17.663Z" fill="#4285F4" />
                <path d="M24.48 48.002c6.502 0 11.964-2.148 15.946-5.834l-7.766-6.028c-2.148 1.44-4.903 2.28-8.174 2.28-6.28 0-11.597-4.242-13.498-9.947l-7.968 6.14c3.95 7.862 12.074 13.389 21.466 13.389Z" fill="#34A853" />
                <path d="M10.982 28.473a14.44 14.44 0 0 1 0-8.954l-7.968-6.14A24.01 24.01 0 0 0 .412 24.001c0 3.87.924 7.534 2.602 10.622l7.968-6.15Z" fill="#FBBC05" />
                <path d="M24.48 9.571c3.44-.054 6.758 1.248 9.28 3.604l6.934-6.934C36.396 2.304 30.61.002 24.48.002 15.088.002 6.964 5.53 3.014 13.379l7.968 6.14c1.9-5.7 7.218-9.948 13.498-9.948Z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
              <div className="h-10 w-10 mx-auto rounded-xl bg-purple-50 flex items-center justify-center mb-3 border border-purple-100">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-xs font-bold text-foreground">AI Drafting</div>
              <div className="text-[10px] text-muted-foreground mt-1">Generate smart replies instantly</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
              <div className="h-10 w-10 mx-auto rounded-xl bg-emerald-50 flex items-center justify-center mb-3 border border-emerald-100">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-xs font-bold text-foreground">Claim Verify</div>
              <div className="text-[10px] text-muted-foreground mt-1">Automated fact-checking</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center shadow-card">
              <div className="h-10 w-10 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3 border border-primary/20">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="text-xs font-bold text-foreground">Smart Inbox</div>
              <div className="text-[10px] text-muted-foreground mt-1">Unified review management</div>
            </div>
          </div>

          <div className="mt-8 text-xs text-center text-muted-foreground font-medium">
            Requires Google Business Profile access to sync reviews
          </div>
        </div>
      </motion.div>
    </div>
  )
}

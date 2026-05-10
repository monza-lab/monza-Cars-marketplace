"use client"

import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Piston } from "@/components/icons/Piston"
import { Bookmark, FileText, LogOut, User } from "lucide-react"

/**
 * Shared account content used by both the mobile bottom sheet
 * (MobileBottomNav.MobileProfileSheet) and the desktop side sheet
 * (Header.DesktopAccountSheet). Same sections, same logic, one source.
 *
 * The "TÚ vs APP" mental model: this component handles only personal data
 * (profile, balance, watchlist, recent reports, plan, sign out). Theme and
 * language preferences live in the Menu sheet, never here.
 */
export function AccountSheetContent({
  onClose,
  onOpenAuth,
}: {
  onClose: () => void
  onOpenAuth: () => void
}) {
  const t = useTranslations()
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()
  const isAuthenticated = !!user
  const creditsRemaining = profile?.creditsBalance ?? 0
  const tier = profile?.tier ?? "FREE"
  const isSubscribed = tier === "MONTHLY" || tier === "ANNUAL"
  const planLabel =
    tier === "FREE"
      ? "Free"
      : tier === "MONTHLY"
        ? "Rennsport · Monthly"
        : tier === "ANNUAL"
          ? "Rennsport · Annual"
          : "Pack"

  const handleSignOut = async () => {
    await signOut()
    onClose()
  }

  const goTo = (href: string) => {
    onClose()
    router.push(href)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 py-4">
        <div className="text-center">
          <div className="size-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <User className="size-7 text-primary" />
          </div>
          <h3 className="font-display text-[22px] font-medium text-foreground">
            {t("auth.welcomeBack")}
          </h3>
          <p className="text-[12px] text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            {t("auth.freeCredits")}
          </p>
        </div>

        <button
          onClick={() => {
            onClose()
            setTimeout(() => onOpenAuth(), 300)
          }}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground text-[14px] font-semibold active:bg-primary/85 hover:bg-primary/90 transition-colors"
        >
          {t("auth.createAccount")}
        </button>

        <p className="text-center text-[12px] text-muted-foreground">
          {/* [HARDCODED] */}Already have an account?{" "}
          <button
            onClick={() => {
              onClose()
              setTimeout(() => onOpenAuth(), 300)
            }}
            className="text-primary font-medium hover:underline"
          >
            {/* [HARDCODED] */}Sign in →
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-foreground/[0.04]">
        <div className="size-12 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <User className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-foreground truncate">
            {profile?.name || "Collector"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {user.email}
          </p>
        </div>
      </div>

      {/* Pistons balance */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
            <Piston className="size-3 text-primary" />
            {/* [HARDCODED] */}Pistons
          </p>
          <button
            onClick={() => goTo("/pricing")}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {/* [HARDCODED] */}Buy →
          </button>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-transparent p-4">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-display text-[36px] font-medium tabular-nums leading-none ${
                creditsRemaining > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {creditsRemaining.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {/* [HARDCODED] */}available
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {/* [HARDCODED] */}Free credits reset on the 1st of each month
          </p>
        </div>
      </section>

      {/* Watchlist */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
            <Bookmark className="size-3 text-primary" />
            {/* [HARDCODED] */}Watchlist
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-foreground/[0.02] p-4">
          <p className="text-[12px] text-muted-foreground italic leading-relaxed">
            {/* [HARDCODED] */}No saved Porsches yet. Tap the bookmark on any
            listing to track it here.
          </p>
        </div>
      </section>

      {/* Recent reports */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
            <FileText className="size-3 text-primary" />
            {/* [HARDCODED] */}Recent reports
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-foreground/[0.02] p-4">
          <p className="text-[12px] text-muted-foreground italic leading-relaxed mb-3">
            {/* [HARDCODED] */}No reports yet. Generate your first one to see
            it here.
          </p>
          <button
            onClick={() => goTo("/cars/porsche")}
            className="w-full py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-[12px] font-semibold text-primary hover:bg-primary/15 active:bg-primary/20 transition-colors"
          >
            {/* [HARDCODED] */}Browse Porsches →
          </button>
        </div>
      </section>

      {/* Plan */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
            {/* [HARDCODED] */}Current plan
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-foreground/[0.02] p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-foreground truncate">
              {planLabel}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isSubscribed
                ? /* [HARDCODED] */ "Unlimited reports while active"
                : /* [HARDCODED] */ "3 free reports / month"}
            </p>
          </div>
          <button
            onClick={() => goTo("/pricing")}
            className="shrink-0 px-4 py-2 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/85 active:bg-primary/85"
          >
            {isSubscribed ? /* [HARDCODED] */ "Manage" : /* [HARDCODED] */ "Upgrade"}
          </button>
        </div>
      </section>

      {/* Useful links — only on desktop or when collapsed mobile lists need quick access */}
      <section className="grid grid-cols-2 gap-2">
        <Link
          href="/search-history"
          onClick={onClose}
          className="rounded-xl border border-border bg-foreground/[0.02] px-3 py-2.5 text-[12px] text-foreground/85 hover:border-primary/30 hover:text-foreground transition-colors text-center"
        >
          {/* [HARDCODED] */}Search history
        </Link>
        <Link
          href="/account"
          onClick={onClose}
          className="rounded-xl border border-border bg-foreground/[0.02] px-3 py-2.5 text-[12px] text-foreground/85 hover:border-primary/30 hover:text-foreground transition-colors text-center"
        >
          {/* [HARDCODED] */}Billing & history
        </Link>
      </section>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border border-border text-[13px] font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-destructive active:bg-foreground/[0.05] transition-colors"
      >
        <LogOut className="size-4" />
        <span>{t("auth.signOut")}</span>
      </button>
    </div>
  )
}

import type { ToolDef } from "@/lib/advisor/tools/registry"
import { getUserCredits as getPistonUserCredits } from "@/lib/reports/queries"

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

export const getUserContext: ToolDef = {
  name: "get_user_context",
  description:
    "Return the caller's tier, locale, region, currency, and Pistons balance. Use to tailor responses and estimate report affordability.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      viewedCars: {
        type: "array",
        items: { type: "string" },
        description: "Optional recently-viewed car ids pulled from the session.",
      },
    },
  },
  async handler(args, ctx) {
    const viewedCars = Array.isArray(args.viewedCars)
      ? (args.viewedCars.filter((v) => typeof v === "string") as string[])
      : []

    let pistonsBalance: number | null = null
    if (ctx.userId) {
      try {
        const credits = await getPistonUserCredits(ctx.userId)
        if (credits && typeof credits.credits_balance === "number") {
          pistonsBalance = credits.credits_balance + (credits.pack_credits_balance ?? 0)
        }
      } catch (err) {
        // If credits lookup fails, leave balance null — do not fail the tool.
        console.error("[get_user_context] credits lookup failed:", err)
      }
    }

    const data = {
      tier: ctx.userTier,
      locale: ctx.locale,
      region: ctx.region ?? null,
      currency: ctx.currency ?? null,
      pistonsBalance,
      viewedCars,
    }
    const summary = truncate(
      `Tier ${ctx.userTier}, locale ${ctx.locale}${ctx.region ? `, region ${ctx.region}` : ""}${
        pistonsBalance != null ? `, ${pistonsBalance} Pistons` : ""
      }.`,
    )
    return { ok: true, data, summary }
  },
}

export const getUserWatchlist: ToolDef = {
  name: "get_user_watchlist",
  description: "Return the caller's watchlist. Phase 2 placeholder: returns an empty list.",
  minTier: "FREE",
  parameters: { type: "object", properties: {} },
  async handler() {
    return {
      ok: true,
      data: { watchedCarIds: [], note: "Watchlist coming soon" },
      summary: "Watchlist feature coming soon — no watched cars returned.",
    }
  },
}

export const userTools: ToolDef[] = [getUserContext, getUserWatchlist]

export type PlanId = "single" | "pack" | "monthly"

export interface PricingPlan {
  id: PlanId
  name: string
  price: number
  priceCents: number
  period: "one-time" | "monthly"
  reports: number | "unlimited"
  perReport: string
  badge?: string
  features: string[]
  cta: string
  billingMode: "payment" | "subscription"
  creditsGranted: number | "unlimited"
}

export const PRICING_PLANS: Record<PlanId, PricingPlan> = {
  single: {
    id: "single",
    name: "Single Report",
    price: 9.99,
    priceCents: 999,
    period: "one-time",
    reports: 1,
    perReport: "$9.99/report",
    features: [
      "1 full investment dossier",
      "10-section analysis",
      "Regional fair value",
      "Never expires",
    ],
    cta: "Buy 1 Report",
    billingMode: "payment",
    creditsGranted: 1,
  },
  pack: {
    id: "pack",
    name: "Reports Pack",
    price: 39,
    priceCents: 3900,
    period: "one-time",
    reports: 5,
    perReport: "$7.80/report",
    features: [
      "5 full investment dossiers",
      "Never expires",
      "Save 22% vs Single",
      "No Watchlist or Alerts",
    ],
    cta: "Buy 5 Reports",
    billingMode: "payment",
    creditsGranted: 5,
  },
  monthly: {
    id: "monthly",
    name: "Monthly",
    price: 59,
    priceCents: 5900,
    period: "monthly",
    reports: "unlimited",
    perReport: "Unlimited reports",
    badge: "BEST VALUE",
    features: [
      "Unlimited Reports",
      "Watchlist (unlimited saves)",
      "Email Alerts on matches",
      "Saved Searches",
      "Priority Generation (faster)",
      "PDF + CSV Export",
      "Cancel anytime",
    ],
    cta: "Go Unlimited",
    billingMode: "subscription",
    creditsGranted: "unlimited",
  },
}

export function isPlanId(value: string): value is PlanId {
  return value === "single" || value === "pack" || value === "monthly"
}

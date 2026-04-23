export type PlanKey =
  | "zuffenhausen"
  | "weissach"
  | "rennsport"
  | "jerrycan"
  | "fuel_cell"
  | "boxenstopp"

export type LegacyPlanKey = "single" | "pack" | "monthly"
export type CheckoutPlanKey = PlanKey | LegacyPlanKey
export type PlanId = CheckoutPlanKey

export interface PricingPlan {
  id: PlanKey
  name: string
  price: number
  priceCents: number
  period: "one-time" | "monthly"
  pistons: number
  reports: number | "unlimited"
  perReport: string
  badge?: string
  features: string[]
  cta: string
  billingMode: "payment" | "subscription"
  unlimitedReports: boolean
  stripeProductId: string | null
  tagline: string
}

export const PRICING_PLANS: Record<PlanKey, PricingPlan> = {
  zuffenhausen: {
    id: "zuffenhausen",
    name: "Zuffenhausen",
    price: 9.99,
    priceCents: 999,
    period: "monthly",
    pistons: 1000,
    reports: 10,
    perReport: "$1.00/report",
    features: [
      "1,000 Pistons every month",
      "10 reports per cycle",
      "Deep Research reserve included",
      "Cancel anytime",
    ],
    cta: "Choose Zuffenhausen",
    billingMode: "subscription",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_ZUFFENHAUSEN_MONTHLY ?? null,
    tagline: "Starter monthly allowance",
  },
  weissach: {
    id: "weissach",
    name: "Weissach",
    price: 39,
    priceCents: 3900,
    period: "monthly",
    pistons: 5000,
    reports: 50,
    perReport: "$0.78/report",
    badge: "BEST VALUE",
    features: [
      "5,000 Pistons every month",
      "50 reports per cycle",
      "Deep Research reserve included",
      "Cancel anytime",
    ],
    cta: "Choose Weissach",
    billingMode: "subscription",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_WEISSACH_MONTHLY ?? null,
    tagline: "Best balance for active hunters",
  },
  rennsport: {
    id: "rennsport",
    name: "Rennsport",
    price: 59,
    priceCents: 5900,
    period: "monthly",
    pistons: 10000,
    reports: "unlimited",
    perReport: "Unlimited reports",
    badge: "LEGACY UNLIMITED",
    features: [
      "10,000 Pistons every month",
      "Unlimited reports",
      "Deep Research reserve included",
      "Legacy unlimited Reports preserved",
    ],
    cta: "Choose Rennsport",
    billingMode: "subscription",
    unlimitedReports: true,
    stripeProductId: process.env.STRIPE_PRODUCT_RENNSPORT_MONTHLY ?? null,
    tagline: "For unlimited report workflows",
  },
  jerrycan: {
    id: "jerrycan",
    name: "Jerrycan",
    price: 9.99,
    priceCents: 999,
    period: "one-time",
    pistons: 600,
    reports: 6,
    perReport: "$1.66/report",
    features: [
      "600 Pistons top-up",
      "Stacks with any plan",
      "Never expires",
      "Use when you need a small refill",
    ],
    cta: "Buy Jerrycan",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_JERRYCAN ?? null,
    tagline: "Small refill",
  },
  fuel_cell: {
    id: "fuel_cell",
    name: "Fuel Cell",
    price: 29,
    priceCents: 2900,
    period: "one-time",
    pistons: 2200,
    reports: 22,
    perReport: "$1.32/report",
    features: [
      "2,200 Pistons top-up",
      "Stacks with any plan",
      "Never expires",
      "Best for occasional bursts",
    ],
    cta: "Buy Fuel Cell",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_FUEL_CELL ?? null,
    tagline: "Mid-sized refill",
  },
  boxenstopp: {
    id: "boxenstopp",
    name: "Boxenstopp",
    price: 59,
    priceCents: 5900,
    period: "one-time",
    pistons: 5000,
    reports: 50,
    perReport: "$1.18/report",
    features: [
      "5,000 Pistons top-up",
      "Stacks with any plan",
      "Never expires",
      "Largest one-time refill",
    ],
    cta: "Buy Boxenstopp",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_BOXENSTOPP ?? null,
    tagline: "Large refill",
  },
}

export const LEGACY_PLAN_ALIASES: Record<LegacyPlanKey, PlanKey> = {
  single: "jerrycan",
  pack: "fuel_cell",
  monthly: "rennsport",
}

export function resolvePlanKey(value: string): PlanKey | null {
  if (value in PRICING_PLANS) return value as PlanKey
  if (value === "single" || value === "pack" || value === "monthly") {
    return LEGACY_PLAN_ALIASES[value]
  }
  return null
}

export function isPlanId(value: string): value is CheckoutPlanKey {
  return resolvePlanKey(value) !== null
}

export function getPricingPlan(value: string): PricingPlan | null {
  const key = resolvePlanKey(value)
  return key ? PRICING_PLANS[key] : null
}

export type PlanKey =
  | "zuffenhausen"
  | "weissach"
  | "rennsport"
  | "jerrycan"
  | "fuel_cell"
  | "boxenstopp"
  | "topup_entry"
  | "topup_active"
  | "topup_heavy"

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
  /** i18n key for the badge label. When set, components should render
   *  `t(badgeKey)` so the badge speaks the user's locale. Falls back to
   *  the legacy `badge` literal if not set. */
  badgeKey?: string
  features: string[]
  cta: string
  billingMode: "payment" | "subscription"
  unlimitedReports: boolean
  stripeProductId: string | null
  tagline: string
  /** Whether this plan is shown in the public /pricing page and
   *  related UI. Legacy plans stay in the registry so historical
   *  customers keep their plans, but they aren't offered to new
   *  customers. Defaults to false when omitted. */
  visibleInPricing?: boolean
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
    visibleInPricing: false,
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
    visibleInPricing: false,
  },
  rennsport: {
    id: "rennsport",
    name: "Genshpod",
    price: 59,
    priceCents: 5900,
    period: "monthly",
    pistons: 10000,
    reports: "unlimited",
    perReport: "Unlimited reports",
    badge: "Most popular",
    features: [
      "Unlimited reports",
      "Unlimited Advisor research and reports",
      "Watchlist and alerts included",
      "Cancel anytime",
    ],
    cta: "Choose Genshpod",
    billingMode: "subscription",
    unlimitedReports: true,
    stripeProductId: process.env.STRIPE_PRODUCT_RENNSPORT_MONTHLY ?? null,
    tagline: "For unlimited report workflows",
    visibleInPricing: true,
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
    visibleInPricing: false,
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
    visibleInPricing: false,
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
    visibleInPricing: false,
  },
  topup_entry: {
    id: "topup_entry",
    name: "1,000 Pistons",
    price: 13,
    priceCents: 1300,
    period: "one-time",
    pistons: 1000,
    reports: 1,
    perReport: "$13/report",
    features: [
      "1,000 Pistons",
      "Never expires",
      "Stacks with any plan",
    ],
    cta: "Add 1,000 Pistons",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_TOPUP_ENTRY ?? null,
    tagline: "Quick refill",
    visibleInPricing: true,
  },
  topup_active: {
    id: "topup_active",
    name: "2,500 Pistons",
    price: 30,
    priceCents: 3000,
    period: "one-time",
    pistons: 2500,
    reports: 2,
    perReport: "$15/report",
    features: [
      "2,500 Pistons",
      "Never expires",
      "Stacks with any plan",
    ],
    cta: "Add 2,500 Pistons",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_TOPUP_ACTIVE ?? null,
    tagline: "Active hunter",
    visibleInPricing: true,
  },
  topup_heavy: {
    id: "topup_heavy",
    name: "10,000 Pistons",
    price: 99,
    priceCents: 9900,
    period: "one-time",
    pistons: 10000,
    reports: 10,
    perReport: "$9.90/report",
    badgeKey: "pricing.badgeBestValue",
    features: [
      "10,000 Pistons",
      "Never expires",
      "Stacks with any plan",
    ],
    cta: "Add 10,000 Pistons",
    billingMode: "payment",
    unlimitedReports: false,
    stripeProductId: process.env.STRIPE_PRODUCT_TOPUP_HEAVY ?? null,
    tagline: "Heavy research",
    visibleInPricing: true,
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

/** Returns top-up (one-time payment) plans that should appear in the
 *  public pricing UI, sorted by ascending price. Used by /pricing and
 *  the OutOfPistonsModal preset list. */
export function getVisibleTopUps(): PricingPlan[] {
  return Object.values(PRICING_PLANS)
    .filter(p => p.visibleInPricing === true && p.billingMode === "payment")
    .sort((a, b) => a.price - b.price)
}

/** Returns subscription plans that should appear in the public
 *  pricing UI, sorted by ascending price. Today returns only Genshpod;
 *  Zuffenhausen and Weissach stay hidden but remain in the registry for
 *  historical customers. */
export function getVisibleSubs(): PricingPlan[] {
  return Object.values(PRICING_PLANS)
    .filter(p => p.visibleInPricing === true && p.billingMode === "subscription")
    .sort((a, b) => a.price - b.price)
}

import { describe, it, expect } from "vitest"
import { PRICING_PLANS, getPricingPlan, getVisibleTopUps, getVisibleSubs } from "./plans"

describe("PRICING_PLANS — wallet recharge model", () => {
  it("has 3 new top-up entries with correct Pistons and prices", () => {
    expect(PRICING_PLANS.topup_entry).toMatchObject({
      id: "topup_entry",
      price: 13,
      priceCents: 1300,
      pistons: 1000,
      period: "one-time",
      billingMode: "payment",
      visibleInPricing: true,
    })
    expect(PRICING_PLANS.topup_active).toMatchObject({
      id: "topup_active",
      price: 30,
      priceCents: 3000,
      pistons: 2500,
      visibleInPricing: true,
    })
    expect(PRICING_PLANS.topup_heavy).toMatchObject({
      id: "topup_heavy",
      price: 99,
      priceCents: 9900,
      pistons: 10000,
      visibleInPricing: true,
    })
  })

  it("marks legacy plans as not visible in pricing", () => {
    expect(PRICING_PLANS.jerrycan.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.fuel_cell.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.boxenstopp.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.zuffenhausen.visibleInPricing).toBe(false)
    expect(PRICING_PLANS.weissach.visibleInPricing).toBe(false)
  })

  it("rennsport is the only visible subscription", () => {
    const visibleSubs = getVisibleSubs()
    expect(visibleSubs).toHaveLength(1)
    expect(visibleSubs[0].id).toBe("rennsport")
    expect(PRICING_PLANS.rennsport.visibleInPricing).toBe(true)
  })

  it("getVisibleTopUps returns 3 top-ups in ascending price order", () => {
    const topUps = getVisibleTopUps()
    expect(topUps).toHaveLength(3)
    expect(topUps.map(p => p.id)).toEqual(["topup_entry", "topup_active", "topup_heavy"])
    expect(topUps[0].price).toBeLessThan(topUps[1].price)
    expect(topUps[1].price).toBeLessThan(topUps[2].price)
  })

  it("getPricingPlan returns the correct plan for new IDs", () => {
    expect(getPricingPlan("topup_entry")?.pistons).toBe(1000)
    expect(getPricingPlan("topup_heavy")?.pistons).toBe(10000)
  })

  it("excludes plans with visibleInPricing undefined from both helpers", () => {
    // Defensive: if a future plan is added and forgets the flag, the
    // strict `=== true` filter in the helpers must keep it out of the
    // public pricing UI. This locks that contract.
    const allPlans = Object.values(PRICING_PLANS)
    const omittedFlag = allPlans.filter(p => p.visibleInPricing === undefined)
    const visibleTopUpIds = new Set(getVisibleTopUps().map(p => p.id))
    const visibleSubIds = new Set(getVisibleSubs().map(p => p.id))
    for (const plan of omittedFlag) {
      expect(visibleTopUpIds.has(plan.id)).toBe(false)
      expect(visibleSubIds.has(plan.id)).toBe(false)
    }
  })
})

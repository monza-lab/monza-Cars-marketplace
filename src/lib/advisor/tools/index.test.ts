import { describe, it, expect } from "vitest"
import { buildDefaultToolRegistry } from "./index"

describe("default tool registry", () => {
  it("contains the expected tool names across groups", () => {
    const reg = buildDefaultToolRegistry()
    const names = reg.listForTier("PRO").map((t) => t.name).sort()
    expect(names).toEqual([
      "assess_red_flags",
      "build_shortlist",
      "compare_listings",
      "compute_price_position",
      "fetch_url",
      "get_comparable_sales",
      "get_inspection_checklist",
      "get_knowledge_article",
      "get_listing",
      "get_price_history",
      "get_regional_valuation",
      "get_series_profile",
      "get_user_context",
      "get_user_watchlist",
      "get_variant_details",
      "list_knowledge_topics",
      "navigate_to",
      "search_listings",
      "trigger_report",
      "web_search",
    ])
  })

  it("hides PRO tools from FREE listing", () => {
    const reg = buildDefaultToolRegistry()
    const names = reg.listForTier("FREE").map((t) => t.name)
    expect(names).not.toContain("web_search")
    expect(names).not.toContain("fetch_url")
  })
})

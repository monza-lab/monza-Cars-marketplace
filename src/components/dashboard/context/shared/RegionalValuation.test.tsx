// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RegionalValuationSection } from "./RegionalValuation"
import type { SegmentStats } from "@/lib/pricing/types"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/lib/RegionContext", () => ({ useRegion: () => ({ effectiveRegion: "US" }) }))
vi.mock("@/lib/CurrencyContext", () => ({
  useCurrency: () => ({ convertFromUsd: (value: number) => value, currencySymbol: "$" }),
}))

const askingOnly: SegmentStats = {
  market: "US",
  family: "997",
  marketValue: { valueUsd: null, p25Usd: null, p75Usd: null, soldN: 0, tier: "insufficient" },
  askMedian: {
    valueUsd: 95_000,
    rawMedianUsd: 100_000,
    p25Usd: 90_000,
    p75Usd: 110_000,
    askingN: 7,
    factorApplied: 0.95,
    factorSource: "family",
    tier: "medium",
  },
}

describe("RegionalValuationSection", () => {
  it("describes a zero-sales market as asking-led in the native tooltip", () => {
    render(<RegionalValuationSection regionalVal={{ US: askingOnly }} />)

    expect(screen.queryByTitle(/sold n=0/i)).not.toBeInTheDocument()
    expect(screen.getByTitle(/asking-led n=7 \(medium\)/i)).toBeInTheDocument()
  })
})

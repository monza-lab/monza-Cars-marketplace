import { describe, expect, it, vi } from "vitest";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { selectClassicBrowsePool } from "./BrowseClient";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/en/browse",
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function car(id: string): DashboardAuction {
  return {
    id,
    title: `2020 Porsche 911 ${id}`,
    make: "Porsche",
    model: "911",
    year: 2020,
    trim: null,
    price: 100000,
    currentBid: 100000,
    bidCount: 1,
    viewCount: 0,
    watchCount: 0,
    status: "ACTIVE",
    endTime: "2026-12-31T00:00:00.000Z",
    platform: "BRING_A_TRAILER",
    engine: null,
    transmission: null,
    exteriorColor: null,
    mileage: null,
    mileageUnit: null,
    location: null,
    region: null,
    description: null,
    images: [],
    analysis: null,
    priceHistory: [],
    canonicalMarket: "US",
    valuationBasis: "asking",
    soldPriceUsd: null,
    askingPriceUsd: 100000,
    family: "992",
  };
}

describe("selectClassicBrowsePool", () => {
  it("suppresses stale remote cars while a server-backed filter change is pending", () => {
    const pool = selectClassicBrowsePool({
      auctions: [car("ssr")],
      remoteCars: [car("old-remote")],
      hasActiveServerFilters: true,
      isFilterPending: true,
    });

    expect(pool).toEqual([]);
  });
});

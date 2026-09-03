// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { BrowseResultsGrid, describeMarketContext, selectClassicBrowsePool, shouldShowBrowseRescue } from "./BrowseClient";

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

describe("BrowseResultsGrid", () => {
  it("keeps the report hero and listing cards in one ordered grid", () => {
    render(
      <BrowseResultsGrid reportHero={<section data-testid="hero">Hero</section>}>
        <article data-testid="listing">Listing</article>
      </BrowseResultsGrid>,
    );

    const grid = screen.getByTestId("browse-results-grid");
    expect(grid.children).toHaveLength(2);
    expect(grid.children[0]).toBe(screen.getByTestId("hero"));
    expect(grid.children[1]).toBe(screen.getByTestId("listing"));
  });
});

describe("describeMarketContext", () => {
  it("makes a single selected market and mileage convention explicit", () => {
    expect(describeMarketContext(["EU"])).toBe("Europe market · mileage shown in kilometres");
    expect(describeMarketContext(["US"])).toBe("United States market · mileage shown in miles");
  });

  it("hides redundant context until a market filter is active", () => {
    expect(describeMarketContext([])).toBe("");
    expect(describeMarketContext(["EU", "US"])).toBe("2 markets selected · mileage follows each card's market");
  });
});

describe("shouldShowBrowseRescue", () => {
  it("appears only after two viewports and never over consent or after a report click", () => {
    expect(shouldShowBrowseRescue({ scrollY: 1601, viewportHeight: 800, consentVisible: false, reportClicked: false })).toBe(true);
    expect(shouldShowBrowseRescue({ scrollY: 1600, viewportHeight: 800, consentVisible: false, reportClicked: false })).toBe(false);
    expect(shouldShowBrowseRescue({ scrollY: 2000, viewportHeight: 800, consentVisible: true, reportClicked: false })).toBe(false);
    expect(shouldShowBrowseRescue({ scrollY: 2000, viewportHeight: 800, consentVisible: false, reportClicked: true })).toBe(false);
  });
});

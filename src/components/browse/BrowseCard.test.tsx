// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { BrowseCard } from "./BrowseCard";

// Stub Next/i18n boundaries that are irrelevant to this component's
// rendering decisions.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock("@/lib/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (n: number) => `$${n.toLocaleString()}` }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

function makeCar(overrides: Partial<DashboardAuction> = {}): DashboardAuction {
  return {
    id: "test-1",
    title: "2023 Porsche 911 GT3",
    make: "Porsche",
    model: "911",
    year: 2023,
    trim: "GT3",
    price: 200_000,
    currentBid: 200_000,
    bidCount: 0,
    viewCount: 0,
    watchCount: 0,
    status: "ACTIVE",
    endTime: "2030-12-31T00:00:00.000Z",
    platform: "AUTO_SCOUT_24",
    engine: null,
    transmission: null,
    exteriorColor: null,
    mileage: 1000,
    mileageUnit: "mi",
    location: null,
    region: null,
    description: null,
    images: [],
    analysis: null,
    priceHistory: [],
    canonicalMarket: "EU",
    ...overrides,
  };
}

describe("BrowseCard — honest-by-data signals", () => {
  it("is visible on the server response instead of waiting for hydration", () => {
    const { getByTestId } = render(<BrowseCard car={makeCar()} index={0} />);
    expect(getByTestId("browse-card")).toHaveAttribute("data-initial-visibility", "visible");
  });

  it("keeps the free report action above the marketplace exit", () => {
    const { getAllByText, getByRole } = render(<BrowseCard car={makeCar({ platform: "ELFERSPOT" })} index={0} sourceUrl="https://example.com/listing" />);
    const reportAction = getAllByText("Free report", { selector: "span" }).at(-1)!;
    const marketplaceAction = getByRole("button", { name: /View on Elferspot/i });

    expect(reportAction.compareDocumentPosition(marketplaceAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("converts source mileage to the card's canonical market unit", () => {
    const { container } = render(<BrowseCard car={makeCar()} index={0} />);
    expect(container.textContent ?? "").toContain("1,609 km");
  });

  it("announces the market and its mileage convention", () => {
    const { getByLabelText } = render(<BrowseCard car={makeCar()} index={0} />);
    expect(getByLabelText("Europe market · mileage shown in kilometres")).toHaveTextContent("EU");
  });

  it("opens the car detail before the report funnel", () => {
    const { container } = render(<BrowseCard car={makeCar()} index={0} />);
    expect(container.querySelector("a")).toHaveAttribute("href", "/cars/porsche/test-1");
  });

  it("shows the literal fair-value band when real regional evidence exists", () => {
    const car = makeCar({
      fairValueByRegion: {
        US: { currency: "$", low: 244_079, high: 280_822 },
        EU: { currency: "€", low: 0, high: 0 },
        UK: { currency: "£", low: 0, high: 0 },
        JP: { currency: "¥", low: 0, high: 0 },
      },
    });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.textContent ?? "").toMatch(/Fair value \$244[.,]079–\$280[.,]822/);
  });

  it("does NOT render the LIVE badge regardless of status", () => {
    const car = makeCar({ status: "ACTIVE" });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.textContent ?? "").not.toContain("LIVE");
  });

  it("does NOT render Gavel + bidCount when bidCount is 0", () => {
    const car = makeCar({ bidCount: 0 });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-gavel")).toBeNull();
  });

  it("renders Gavel + bidCount when bidCount > 0", () => {
    const car = makeCar({ bidCount: 14, platform: "BRING_A_TRAILER" });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-gavel")).not.toBeNull();
    expect(container.textContent ?? "").toContain("14");
  });

  it("does NOT render Clock countdown when bidCount is 0 (even if endTime is future)", () => {
    const car = makeCar({ bidCount: 0, endTime: "2099-01-01T00:00:00.000Z" });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-clock")).toBeNull();
  });

  it("renders Clock countdown when bidCount > 0 AND endTime is in the future", () => {
    const car = makeCar({
      bidCount: 5,
      endTime: "2099-01-01T00:00:00.000Z",
      platform: "BRING_A_TRAILER",
    });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-clock")).not.toBeNull();
  });

  it("does NOT render Clock countdown when endTime is in the past", () => {
    const car = makeCar({
      bidCount: 5,
      endTime: "2000-01-01T00:00:00.000Z",
      platform: "BRING_A_TRAILER",
    });
    const { container } = render(<BrowseCard car={car} index={0} />);
    expect(container.querySelector(".lucide-clock")).toBeNull();
  });
});

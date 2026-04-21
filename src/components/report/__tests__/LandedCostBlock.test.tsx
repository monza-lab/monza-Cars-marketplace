// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandedCostBlock } from "../LandedCostBlock";
import type { LandedCostBreakdown } from "@/lib/landedCost";

const sample: LandedCostBreakdown = {
  destination: "US",
  origin: "DE",
  currency: "USD",
  carPriceLocal: { min: 85000, max: 85000, currency: "USD" },
  shipping: { min: 2800, max: 5200, currency: "USD" },
  marineInsurance: { min: 1275, max: 2125, currency: "USD" },
  customsDuty: { min: 0, max: 0, currency: "USD" },
  vatOrSalesTax: { min: 5287, max: 5544, currency: "USD" },
  portAndBroker: { min: 800, max: 1500, currency: "USD" },
  registration: { min: 200, max: 500, currency: "USD" },
  importCosts: { min: 10362, max: 14869, currency: "USD" },
  landedCost: { min: 95362, max: 99869, currency: "USD" },
  notes: ["25-year US import rule: 0% customs duty applied."],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourcesUsed: {} as any,
};

describe("LandedCostBlock", () => {
  it("renders destination, origin and all 6 line items", () => {
    render(<LandedCostBlock breakdown={sample} locale="en-US" />);
    expect(screen.getByText(/United States/i)).toBeInTheDocument();
    expect(screen.getByText(/Germany/i)).toBeInTheDocument();
    expect(screen.getByText(/International shipping/i)).toBeInTheDocument();
    expect(screen.getByText(/Marine insurance/i)).toBeInTheDocument();
    // Customs duty may also appear in the exemption note; match only the <dt>.
    expect(screen.getAllByText(/Customs duty/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sales tax|VAT|Consumption/i)).toBeInTheDocument();
    expect(screen.getByText(/Port & broker/i)).toBeInTheDocument();
    expect(screen.getByText(/Registration/i)).toBeInTheDocument();
  });

  it("shows the 25-year exemption note", () => {
    render(<LandedCostBlock breakdown={sample} locale="en-US" />);
    expect(screen.getByText(/25-year/i)).toBeInTheDocument();
  });

  it("renders import costs, car price, and total landed cost", () => {
    render(<LandedCostBlock breakdown={sample} locale="en-US" />);
    expect(screen.getByText(/Import & delivery costs/i)).toBeInTheDocument();
    expect(screen.getByText(/Car price/i)).toBeInTheDocument();
    expect(screen.getByText(/Total landed cost/i)).toBeInTheDocument();
  });
});

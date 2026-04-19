import { describe, it, expect } from "vitest";
import { sourceToCanonicalMarket, AUCTION_SOURCES } from "../canonicalMarket";

describe("sourceToCanonicalMarket", () => {
  it("BaT and ClassicCom are US", () => {
    expect(sourceToCanonicalMarket("BaT")).toBe("US");
    expect(sourceToCanonicalMarket("Bring a Trailer")).toBe("US");
    expect(sourceToCanonicalMarket("ClassicCom")).toBe("US");
  });

  it("AutoScout24 and Elferspot are EU", () => {
    expect(sourceToCanonicalMarket("AutoScout24")).toBe("EU");
    expect(sourceToCanonicalMarket("Elferspot")).toBe("EU");
  });

  it("AutoTrader is UK", () => {
    expect(sourceToCanonicalMarket("AutoTrader")).toBe("UK");
  });

  it("BeForward is JP", () => {
    expect(sourceToCanonicalMarket("BeForward")).toBe("JP");
  });

  it("unknown source returns null", () => {
    expect(sourceToCanonicalMarket("Craigslist")).toBeNull();
    expect(sourceToCanonicalMarket("")).toBeNull();
  });

  it("AUCTION_SOURCES contains BaT and ClassicCom only", () => {
    expect(AUCTION_SOURCES).toContain("BaT");
    expect(AUCTION_SOURCES).toContain("ClassicCom");
    expect(AUCTION_SOURCES).not.toContain("AutoScout24");
  });
});

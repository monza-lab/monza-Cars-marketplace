import { describe, it, expect } from "vitest";
import { enrichFairValues } from "../supabaseLiveListings";
import type { CollectorCar } from "../curatedCars";

function mkCar(over: Partial<CollectorCar>): CollectorCar {
  return {
    id: "x",
    title: "t",
    year: 2015,
    make: "Porsche",
    model: "911 Carrera",
    trim: null,
    price: 0,
    trend: "",
    trendValue: 0,
    thesis: "",
    image: "",
    images: [],
    engine: "",
    transmission: "",
    mileage: 0,
    mileageUnit: "mi",
    location: "",
    region: "US",
    fairValueByRegion: {
      US: { currency: "$", low: 0, high: 0 },
      EU: { currency: "€", low: 0, high: 0 },
      UK: { currency: "£", low: 0, high: 0 },
      JP: { currency: "¥", low: 0, high: 0 },
    },
    history: "",
    platform: "BRING_A_TRAILER",
    status: "ACTIVE",
    currentBid: 0,
    bidCount: 0,
    endTime: new Date(),
    category: "Live",
    ...over,
  } as CollectorCar;
}

describe("enrichFairValues with segment stats", () => {
  it("sets fair-value bands from sold IQR for a segment with enough sold rows", async () => {
    const cars: CollectorCar[] = [];
    // 30 US 991 sold rows between 80k and 110k
    for (let i = 0; i < 30; i++) {
      cars.push(
        mkCar({
          id: `s-${i}`,
          soldPriceUsd: 80000 + i * 1000,
          askingPriceUsd: null,
          valuationBasis: "sold",
          canonicalMarket: "US",
          family: "991",
        }),
      );
    }
    // A car to receive the fair value
    const subject = mkCar({
      id: "subject",
      valuationBasis: "unknown",
      canonicalMarket: "US",
      family: "991",
    });
    cars.push(subject);

    await enrichFairValues(cars, {});
    expect(subject.fairValueByRegion.US.low).toBeGreaterThan(80000);
    expect(subject.fairValueByRegion.US.low).toBeLessThan(100000);
    expect(subject.fairValueByRegion.US.high).toBeGreaterThan(subject.fairValueByRegion.US.low);
    // JP has no data → 0/0 (insufficient signal)
    expect(subject.fairValueByRegion.JP.low).toBe(0);
    expect(subject.fairValueByRegion.JP.high).toBe(0);
  });
});

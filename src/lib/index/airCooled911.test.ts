import { describe, it, expect } from "vitest";
import {
  bucketize,
  summarize,
  classifyAirCooled,
  toCsv,
  AIR_COOLED_SERIES,
} from "./airCooled911";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";

function mk(
  overrides: Partial<SoldListingRecord> & { model: string; year: number; date: string; price: number }
): SoldListingRecord {
  return {
    title: `${overrides.year} Porsche ${overrides.model}`,
    ...overrides,
  };
}

describe("classifyAirCooled", () => {
  it("classifies a 964 Carrera as air-cooled 964", () => {
    const r = mk({ model: "911 Carrera", year: 1991, date: "2024-03-01", price: 75000 });
    expect(classifyAirCooled(r)).toBe("964");
  });

  it("rejects a modern 992", () => {
    const r = mk({ model: "911 Carrera", year: 2022, date: "2024-03-01", price: 120000 });
    expect(classifyAirCooled(r)).toBeNull();
  });

  it("rejects a water-cooled 996", () => {
    const r = mk({ model: "911 Carrera", year: 2000, date: "2024-03-01", price: 30000 });
    expect(classifyAirCooled(r)).toBeNull();
  });
});

describe("bucketize", () => {
  it("groups same quarter + series and computes median", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera 2", year: 1991, date: "2024-01-15", price: 70000 }),
      mk({ model: "911 Carrera 2", year: 1992, date: "2024-02-20", price: 80000 }),
      mk({ model: "911 Carrera 4", year: 1991, date: "2024-03-10", price: 75000 }),
    ];
    const buckets = bucketize(records);
    const q1_964 = buckets.find((b) => b.quarter === "2024-Q1" && b.series === "964");
    expect(q1_964).toBeDefined();
    expect(q1_964!.count).toBe(3);
    expect(q1_964!.median).toBe(75000);
  });

  it("splits different series into separate buckets", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-15", price: 70000 }),
      mk({ model: "911 Carrera", year: 1996, date: "2024-01-20", price: 120000 }),
    ];
    const buckets = bucketize(records);
    const seriesInQ1 = buckets.filter((b) => b.quarter === "2024-Q1").map((b) => b.series);
    expect(seriesInQ1).toContain("964");
    expect(seriesInQ1).toContain("993");
  });

  it("filters out zero-price records", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-15", price: 0 }),
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-20", price: 70000 }),
    ];
    const buckets = bucketize(records);
    const q1_964 = buckets.find((b) => b.quarter === "2024-Q1" && b.series === "964");
    expect(q1_964!.count).toBe(1);
  });

  it("sorts chronologically then by series", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera", year: 1991, date: "2024-06-01", price: 80000 }),
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-15", price: 70000 }),
      mk({ model: "911 Carrera", year: 1996, date: "2024-01-20", price: 120000 }),
    ];
    const buckets = bucketize(records);
    expect(buckets[0].quarter).toBe("2024-Q1");
    expect(buckets[buckets.length - 1].quarter).toBe("2024-Q2");
  });
});

describe("summarize", () => {
  it("computes YoY change from two consecutive-year same-quarter buckets", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera", year: 1991, date: "2023-01-15", price: 50000 }),
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-15", price: 75000 }),
    ];
    const summaries = summarize(bucketize(records));
    const s964 = summaries.find((s) => s.series === "964")!;
    expect(s964.latestMedian).toBe(75000);
    expect(s964.yoyChangePct).toBeCloseTo(50, 1);
  });

  it("returns null for missing YoY reference", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-15", price: 75000 }),
    ];
    const summaries = summarize(bucketize(records));
    const s964 = summaries.find((s) => s.series === "964")!;
    expect(s964.yoyChangePct).toBeNull();
  });

  it("returns a summary entry for every air-cooled series even when empty", () => {
    const summaries = summarize([]);
    expect(summaries).toHaveLength(AIR_COOLED_SERIES.length);
    for (const s of summaries) {
      expect(s.latestMedian).toBeNull();
      expect(s.sampleSize).toBe(0);
    }
  });
});

describe("toCsv", () => {
  it("produces a header row and one row per bucket", () => {
    const records: SoldListingRecord[] = [
      mk({ model: "911 Carrera", year: 1991, date: "2024-01-15", price: 70000 }),
      mk({ model: "911 Carrera", year: 1996, date: "2024-01-20", price: 120000 }),
    ];
    const payload = {
      generatedAt: new Date().toISOString(),
      sampleSize: 2,
      buckets: bucketize(records),
      summaries: summarize(bucketize(records)),
    };
    const csv = toCsv(payload);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("quarter,series,median,mean,count,min,max");
    expect(lines).toHaveLength(3);
  });
});

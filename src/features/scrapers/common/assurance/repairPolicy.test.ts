import { describe, expect, it } from "vitest";

import { parseEvidenceArgs } from "../../../../../scripts/record-scraper-assurance-evidence";
import { assertSafeListingPatch, buildEvidencePatch } from "./repairPolicy";

describe("scraper assurance repair policy", () => {
  it("rejects lifecycle mutation", () => {
    expect(() => assertSafeListingPatch({ status: "delisted" }))
      .toThrow("Prohibited listing field: status");
  });

  it("rejects identity mutation", () => {
    expect(() => assertSafeListingPatch({ source: "Other" }))
      .toThrow("Prohibited listing field: source");
  });

  it("rejects unknown mutation fields", () => {
    expect(() => assertSafeListingPatch({ arbitrary_sql: "DROP TABLE listings" }))
      .toThrow("Prohibited listing field: arbitrary_sql");
  });

  it("allows only additive or corrective enrichment fields", () => {
    expect(() => assertSafeListingPatch({
      vin: "WP0ZZZ99ZLS123456",
      images: ["https://example.test/car.jpg"],
      enrichment_meta: {},
    })).not.toThrow();
  });

  it("requires complete evidence for unavailable fields", () => {
    expect(() => buildEvidencePatch({
      field: "vin",
      state: "unavailable_at_source",
      checkedAt: "2026-07-13T00:00:00Z",
      sourceUrl: "https://example.test/car/1",
      method: "detail-page-inspection",
      evidenceHash: "",
    })).toThrow("evidenceHash");
  });

  it("merges evidence without discarding unrelated enrichment metadata", () => {
    const patch = buildEvidencePatch({
      field: "vin",
      state: "unavailable_at_source",
      checkedAt: "2026-07-13T00:00:00Z",
      sourceUrl: "https://example.test/car/1",
      method: "detail-page-inspection",
      evidenceHash: "sha256:abc123",
      existingMeta: { provider: "existing", assurance: { runId: "run-1" } },
    });

    expect(patch).toEqual({
      enrichment_meta: expect.objectContaining({
        provider: "existing",
        assurance: expect.objectContaining({
          runId: "run-1",
          fields: {
            vin: expect.objectContaining({ state: "unavailable_at_source" }),
          },
        }),
      }),
    });
  });

  it("rejects generic or unknown CLI mutation arguments", () => {
    expect(() => parseEvidenceArgs(["--sql=UPDATE listings SET status='sold'"]))
      .toThrow("Unsupported argument");
  });

  it("accepts only the bounded evidence CLI contract", () => {
    expect(parseEvidenceArgs([
      "--listing=5f1e9c92-7c8d-4c4a-8f20-eac9ab55a012",
      "--field=vin",
      "--state=unavailable_at_source",
      "--source-url=https://example.test/car/1",
      "--method=detail-page-inspection",
      "--evidence-hash=sha256:abc123",
    ])).toEqual(expect.objectContaining({ field: "vin", state: "unavailable_at_source" }));
  });
});

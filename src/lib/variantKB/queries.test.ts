import { describe, it, expect, beforeEach } from "vitest"
import {
  getKBEntriesForVariant,
  registerKBEntryForTesting,
  clearKBForTesting,
} from "./queries"

beforeEach(() => clearKBForTesting())

describe("getKBEntriesForVariant", () => {
  it("returns empty array when no entries", async () => {
    const entries = await getKBEntriesForVariant("unknown")
    expect(entries).toEqual([])
  })

  it("returns entries filtered by variant", async () => {
    registerKBEntryForTesting({
      id: "k1",
      variant_key: "992_gt3",
      claim_text: "PTS Y5C is ~12% of 992 GT3 order book in 2023",
      source_type: "editorial_curation",
      source_ref: "https://rennlist.example",
      source_capture_date: "2026-04-01",
      verified_at: "2026-04-01",
      verification_method: "manual review",
      confidence: "medium",
      tags: ["pts_rarity"],
      supersedes: null,
      created_by: "monza_editorial",
      created_at: "2026-04-01T00:00:00Z",
    })
    const entries = await getKBEntriesForVariant("992_gt3")
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe("k1")
  })

  it("supersedes chain: excludes superseded entries", async () => {
    registerKBEntryForTesting({
      id: "k1",
      variant_key: "992_gt3",
      claim_text: "old claim",
      source_type: "editorial_curation",
      source_ref: "ref",
      source_capture_date: "2026-01-01",
      verified_at: "2026-01-01",
      verification_method: null,
      confidence: "medium",
      tags: [],
      supersedes: null,
      created_by: "monza_editorial",
      created_at: "2026-01-01T00:00:00Z",
    })
    registerKBEntryForTesting({
      id: "k2",
      variant_key: "992_gt3",
      claim_text: "updated claim",
      source_type: "editorial_curation",
      source_ref: "ref",
      source_capture_date: "2026-04-01",
      verified_at: "2026-04-01",
      verification_method: null,
      confidence: "medium",
      tags: [],
      supersedes: "k1",
      created_by: "monza_editorial",
      created_at: "2026-04-01T00:00:00Z",
    })
    const entries = await getKBEntriesForVariant("992_gt3")
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe("k2")
  })
})

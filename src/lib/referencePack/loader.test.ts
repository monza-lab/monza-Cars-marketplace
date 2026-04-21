import { describe, it, expect, beforeEach } from "vitest"
import { loadReferencePack, registerPackForTesting, clearPacksForTesting } from "./loader"
import type { ReferencePack } from "./types"

beforeEach(() => {
  clearPacksForTesting()
})

describe("loadReferencePack", () => {
  it("returns null when no pack exists for variant", async () => {
    const pack = await loadReferencePack("unknown_variant")
    expect(pack).toBeNull()
  })

  it("returns registered pack for variant", async () => {
    const mock: ReferencePack = {
      variant_key: "992_gt3_touring",
      entries: [
        {
          id: "p1",
          variant_key: "992_gt3_touring",
          category: "production_numbers",
          claim_text: "2,500 units produced globally 2022-2024",
          source_name: "Porsche Press",
          source_url: "https://press.porsche.com/example",
          source_capture_date: "2026-04-01",
          confidence: "high",
        },
      ],
      last_updated: "2026-04-15",
    }
    registerPackForTesting(mock)
    const pack = await loadReferencePack("992_gt3_touring")
    expect(pack).toEqual(mock)
  })
})

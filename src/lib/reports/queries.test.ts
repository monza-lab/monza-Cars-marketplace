import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Supabase client
type SupaResult = { error: null | { message: string } }
const mockSelect = vi.fn()
const mockInsert = vi.fn<(...args: unknown[]) => Promise<SupaResult>>(() =>
  Promise.resolve({ error: null }),
)
const mockUpdate = vi.fn()
const mockUpsert = vi.fn<(...args: unknown[]) => Promise<SupaResult>>(() =>
  Promise.resolve({ error: null }),
)
const mockFrom = vi.fn((_table: string) => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  upsert: mockUpsert,
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}))

// Mock env vars
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key")

describe("reports/queries exports", () => {
  it("exports expected functions", async () => {
    const mod = await import("./queries")
    expect(typeof mod.getReportForListing).toBe("function")
    expect(typeof mod.saveReport).toBe("function")
    expect(typeof mod.getOrCreateUser).toBe("function")
    expect(typeof mod.hasAlreadyGenerated).toBe("function")
    expect(typeof mod.deductCredit).toBe("function")
    expect(typeof mod.checkAndResetFreeCredits).toBe("function")
    expect(typeof mod.saveHausReport).toBe("function")
    expect(typeof mod.saveSignals).toBe("function")
  })
})

describe("saveHausReport", () => {
  beforeEach(() => {
    mockFrom.mockClear()
    mockUpsert.mockClear()
    mockUpsert.mockImplementation(() => Promise.resolve({ error: null }))
  })

  it("calls upsert on listing_reports", async () => {
    const { saveHausReport } = await import("./queries")
    const report = {
      fair_value_low: 100,
      fair_value_high: 200,
      median_price: 150,
      specific_car_fair_value_low: 140,
      specific_car_fair_value_mid: 150,
      specific_car_fair_value_high: 160,
      comparable_layer_used: "strict" as const,
      comparables_count: 7,
      signals_detected: [],
      signals_missing: [],
      modifiers_applied: [],
      modifiers_total_percent: 0,
      signals_extracted_at: new Date().toISOString(),
      extraction_version: "v1.0",
    }
    await expect(saveHausReport("listing-id", report)).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith("listing_reports")
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const call = mockUpsert.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { onConflict: string },
    ]
    const [row, opts] = call
    expect(row.listing_id).toBe("listing-id")
    expect(row.specific_car_fair_value_mid).toBe(150)
    expect(row.modifiers_applied_json).toEqual([])
    expect(opts).toEqual({ onConflict: "listing_id" })
  })

  it("throws when supabase returns error", async () => {
    mockUpsert.mockImplementationOnce(() =>
      Promise.resolve({ error: { message: "db down" } }),
    )
    const { saveHausReport } = await import("./queries")
    const report = {
      fair_value_low: 100,
      fair_value_high: 200,
      median_price: 150,
      specific_car_fair_value_low: 140,
      specific_car_fair_value_mid: 150,
      specific_car_fair_value_high: 160,
      comparable_layer_used: "strict" as const,
      comparables_count: 7,
      signals_detected: [],
      signals_missing: [],
      modifiers_applied: [],
      modifiers_total_percent: 0,
      signals_extracted_at: null,
      extraction_version: "v1.0",
    }
    await expect(saveHausReport("listing-id", report)).rejects.toThrow(
      /saveHausReport failed: db down/,
    )
  })
})

describe("saveSignals", () => {
  beforeEach(() => {
    mockFrom.mockClear()
    mockInsert.mockClear()
    mockInsert.mockImplementation(() => Promise.resolve({ error: null }))
  })

  it("no-ops when signals is empty", async () => {
    const { saveSignals } = await import("./queries")
    await expect(
      saveSignals("listing-id", "run-id", "v1.0", []),
    ).resolves.toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("inserts mapped rows for provided signals", async () => {
    const { saveSignals } = await import("./queries")
    const signals = [
      {
        key: "paint_to_sample",
        name_i18n_key: "report.signals.paint_to_sample",
        value_display: "Gulf Blue (PTS code Y5C)",
        evidence: {
          source_type: "listing_text" as const,
          source_ref: "description_text:char_244-311",
          raw_excerpt: "Paint to Sample Gulf Blue",
          confidence: "high" as const,
        },
      },
    ]
    await expect(
      saveSignals("listing-id", "run-id", "v1.0", signals),
    ).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith("listing_signals")
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const call = mockInsert.mock.calls[0] as unknown as [
      Array<Record<string, unknown>>,
    ]
    const rows = call[0]
    expect(rows).toHaveLength(1)
    expect(rows[0].signal_key).toBe("paint_to_sample")
    expect(rows[0].extraction_run_id).toBe("run-id")
    expect(rows[0].extraction_version).toBe("v1.0")
    expect(rows[0].evidence_confidence).toBe("high")
    expect(rows[0].signal_value_json).toEqual({
      value_display: "Gulf Blue (PTS code Y5C)",
      name_i18n_key: "report.signals.paint_to_sample",
    })
  })

  it("throws when supabase insert errors", async () => {
    mockInsert.mockImplementationOnce(() =>
      Promise.resolve({ error: { message: "insert fail" } }),
    )
    const { saveSignals } = await import("./queries")
    const signals = [
      {
        key: "k",
        name_i18n_key: "n",
        value_display: "v",
        evidence: {
          source_type: "structured_field" as const,
          source_ref: "listings.x",
          raw_excerpt: null,
          confidence: "medium" as const,
        },
      },
    ]
    await expect(
      saveSignals("listing-id", "run-id", "v1.0", signals),
    ).rejects.toThrow(/saveSignals failed: insert fail/)
  })
})

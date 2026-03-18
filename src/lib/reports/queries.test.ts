import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Supabase client
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
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
  })
})

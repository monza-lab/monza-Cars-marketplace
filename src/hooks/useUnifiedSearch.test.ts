// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useUnifiedSearch } from "./useUnifiedSearch"

const trendingPayload = {
  listings: [
    {
      id: "live-1",
      title: "Trend 1",
      year: 2020,
      model: "911",
      image: null,
      priceUsd: 100000,
      platform: "BRING_A_TRAILER",
      status: "live",
      series: "992",
    },
  ],
  total: 1,
}

const queryPayload = {
  listings: [
    {
      id: "live-2",
      title: "997 Turbo",
      year: 2007,
      model: "911 Turbo",
      image: null,
      priceUsd: 145000,
      platform: "BRING_A_TRAILER",
      status: "live",
      series: "997",
    },
  ],
  total: 1,
}

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
  vi.useRealTimers()
})

function ok(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body } as Response)
}

describe("useUnifiedSearch", () => {
  it("loads trending listings on mount with empty query", async () => {
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await waitFor(() => expect(result.current.listings.length).toBe(1))
    expect(result.current.listings[0].title).toBe("Trend 1")
    expect(mockFetch).toHaveBeenCalled()
    expect(String(mockFetch.mock.calls[0][0])).toContain("trending=true")
  })

  it("fetches the latest query immediately without an artificial debounce", async () => {
    vi.useFakeTimers()
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    mockFetch.mockReset()
    mockFetch.mockReturnValue(ok(queryPayload))

    act(() => result.current.setQuery("997"))
    await act(async () => {})

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain("q=997")
  })

  it("filters series client-side as the query changes", async () => {
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await waitFor(() => expect(result.current.series.length).toBeGreaterThan(0))
    const initial = result.current.series.length
    act(() => result.current.setQuery("997"))
    await waitFor(() => expect(result.current.series.length).toBeLessThan(initial))
    expect(result.current.series.map((s) => s.id)).toContain("997")
  })

  it("includes activeSeries in the listings request when set", async () => {
    vi.useFakeTimers()
    mockFetch.mockReturnValue(ok(trendingPayload))
    const { result } = renderHook(() => useUnifiedSearch())
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    mockFetch.mockReset()
    mockFetch.mockReturnValue(ok(queryPayload))
    act(() => result.current.setActiveSeries("997"))
    await act(async () => {})
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(String(mockFetch.mock.calls[0][0])).toContain("series=997")
  })
})

// @vitest-environment jsdom
import { render, screen, act, waitFor } from "@testing-library/react"
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { useLiveSidebarListings } from "./useLiveSidebarListings"

type LiveAuction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  price: number
  currentBid: number
  bidCount: number
  viewCount: number
  watchCount: number
  status: string
  endTime: string
  platform: string
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  mileageUnit: string | null
  location: string | null
  region?: string | null
  description: string | null
  images: string[]
}

function makeAuction(
  id: string,
  endTime: string,
  overrides?: Partial<Pick<LiveAuction, "model" | "year" | "title">>,
): LiveAuction {
  return {
    id,
    title: overrides?.title ?? `2024 Porsche 911 ${id}`,
    make: "Porsche",
    model: overrides?.model ?? "911",
    year: overrides?.year ?? 2024,
    trim: null,
    price: 170000,
    currentBid: 170000,
    bidCount: 12,
    viewCount: 0,
    watchCount: 0,
    status: "ACTIVE",
    endTime,
    platform: "AS24",
    engine: null,
    transmission: null,
    exteriorColor: null,
    mileage: null,
    mileageUnit: null,
    location: null,
    region: "EU",
    description: null,
    images: ["https://example.com/car.jpg"],
  }
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  callback: IntersectionObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target: document.createElement("div"),
          time: 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
        },
      ],
      this as unknown as IntersectionObserver,
    )
  }
}

function TestSidebar({
  seedAuctions,
  seedKey,
  activeFamilyName,
}: {
  seedAuctions: LiveAuction[]
  seedKey: string
  activeFamilyName?: string
}) {
  const { liveAuctions, liveCount, sentinelRef, scrollRootRef } = useLiveSidebarListings({
    seedAuctions,
    seedKey,
    make: "Porsche",
    activeFamilyName,
    pageSize: 1,
  })

  return (
    <div ref={scrollRootRef}>
      <div>
        <div data-testid="live-count">{liveCount}</div>
        {liveAuctions.map((auction) => (
          <div key={auction.id}>{auction.title}</div>
        ))}
        <div ref={sentinelRef} data-testid="sentinel" />
      </div>
    </div>
  )
}

describe("useLiveSidebarListings", () => {
  const seed = makeAuction("seed-1", "2026-04-20T11:00:00.000Z")
  const firstPage = makeAuction("page-1", "2026-04-20T11:02:00.000Z")
  const nextPage = makeAuction("page-2", "2026-04-20T11:05:00.000Z")
  const caymanSeed = makeAuction("cayman-seed", "2026-04-20T11:01:00.000Z", {
    model: "718 Cayman",
    year: 2024,
    title: "2024 Porsche 718 Cayman cayman-seed",
  })

  beforeEach(() => {
    // Pin "now" to just before the hardcoded endTime values so live-status filter
    // (endTime > Date.now()) keeps the seed visible regardless of when the suite runs.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"))
    MockIntersectionObserver.instances = []
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as unknown as typeof IntersectionObserver)
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            auctions: [firstPage],
            hasMore: true,
            nextCursor: "cursor-1",
            totalCount: 3,
            totalLiveCount: 3,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            auctions: [nextPage],
            hasMore: false,
            nextCursor: null,
            totalCount: 3,
            totalLiveCount: 3,
          }),
        }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("keeps the seeded rows visible and fetches the next page only when the sentinel intersects", async () => {
    render(<TestSidebar seedAuctions={[seed]} seedKey="region:all|family:none" />)

    expect(screen.getByText(seed.title)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(firstPage.title)).toBeInTheDocument()
    })
    expect(screen.getByTestId("live-count")).toHaveTextContent("3")

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      "/api/mock-auctions",
    )
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).not.toContain(
      "cursor=",
    )

    await waitFor(() => {
      expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0)
    })

    await act(async () => {
      MockIntersectionObserver.instances[0].trigger(true)
    })

    await waitFor(() => {
      expect(screen.getByText(nextPage.title)).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0])).toContain(
      "cursor=cursor-1",
    )
  })

  it("normalizes display labels like 718 Cayman to the canonical family key for paging", async () => {
    render(
      <TestSidebar
        seedAuctions={[caymanSeed]}
        seedKey="region:all|family:718 Cayman"
        activeFamilyName="718 Cayman"
      />,
    )

    expect(screen.getByText(caymanSeed.title)).toBeInTheDocument()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toContain(
      "family=718-cayman",
    )
  })
})

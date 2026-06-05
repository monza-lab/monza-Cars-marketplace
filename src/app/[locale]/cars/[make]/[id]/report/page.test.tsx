import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi, beforeEach } from "vitest"

type ReportClientProps = {
  userHasAccess: boolean
  existingReport: unknown
  v3Report: unknown
  dbComparables: unknown[]
  similarCars: unknown[]
}

const ReportClientMock = vi.fn((props: ReportClientProps) => {
  void props
  return <div data-testid="report-client">preview</div>
})

// Stubear los módulos de Next.js que el page importa transitivamente.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn().mockResolvedValue(((key: string) => key) as never),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => ((key: string) => key) as never,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
      <a href={href} {...props}>{children}</a>
    ),
  }),
}))
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  })),
}))

// Los client components son irrelevantes — sólo nos importa que la
// función ReportPage resuelva sin tirar 500.
vi.mock("./ReportClient", () => ({
  ReportClient: ReportClientMock,
}))

// Datos del carro: usamos un id "live-test" para forzar el path live
// (que es donde están las llamadas a blindar).
const mockCar = {
  id: "live-test",
  make: "Porsche",
  model: "911",
  year: 2020,
  trim: null,
  title: "test",
  region: "US",
  price: 100000,
  currentBid: 100000,
  soldPriceUsd: null,
  askingPriceUsd: 100000,
  category: "sports",
  images: [],
};

vi.mock("@/lib/curatedCars", () => ({
  CURATED_CARS: [],
}))

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: vi.fn().mockResolvedValue(mockCar),
  fetchLiveListingByIdWithStatus: vi.fn().mockResolvedValue({
    car: mockCar,
    transientError: false,
  }),
  fetchPricedListingsForModel: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/reportLivePeers", () => ({
  fetchStrictLiveReportPeerCandidates: vi.fn().mockResolvedValue([
    { ...mockCar, id: "live-peer", model: "911" },
  ]),
}))

vi.mock("@/lib/exchangeRates", () => ({
  getExchangeRates: vi.fn().mockRejectedValue(new Error("rates api down")),
}))

vi.mock("@/lib/marketIntel/computeArbitrageForCar", () => ({
  computeArbitrageForCar: vi.fn().mockRejectedValue(new Error("arbitrage failed")),
  inferTargetRegion: vi.fn().mockReturnValue("US"),
}))

vi.mock("@/lib/marketStats", () => ({
  computeMarketStatsForCar: vi.fn().mockReturnValue({ marketStats: null }),
}))

vi.mock("@/lib/similarCars", () => ({
  findStrictReportPeers: vi.fn().mockReturnValue([
    { car: { ...mockCar, id: "live-peer", model: "911" }, score: 100, matchReasons: ["Same model variant"] },
  ]),
}))

vi.mock("@/lib/db/queries", () => ({
  getStrictComparablesForModel: vi.fn().mockResolvedValue([
    {
      title: "2020 Porsche 911",
      platform: "BRING_A_TRAILER",
      soldDate: "2026-01-01T00:00:00.000Z",
      soldPrice: 100000,
      mileage: 5000,
      condition: "excellent",
    },
  ]),
}))

vi.mock("@/lib/reports/queries", () => ({
  getReportForListing: vi.fn().mockResolvedValue(null),
  fetchSignalsForListing: vi.fn().mockResolvedValue([]),
  assembleHausReportFromDB: vi.fn().mockReturnValue(null),
  getReportMetadataV2: vi.fn().mockResolvedValue({ tier: null, report_hash: null, version: null }),
  getUserCredits: vi.fn().mockResolvedValue(null),
  hasAlreadyGenerated: vi.fn().mockResolvedValue(false),
  hasUnlimitedReportAccess: vi.fn().mockReturnValue(false),
}))

describe("ReportPage SSR robustness", () => {
  beforeEach(() => vi.clearAllMocks())

  it("does NOT throw when fetchStrictLiveReportPeerCandidates rejects", async () => {
    const { fetchStrictLiveReportPeerCandidates } = await import("@/lib/reportLivePeers")
    vi.mocked(fetchStrictLiveReportPeerCandidates).mockRejectedValueOnce(new Error("supabase down"))

    const { default: ReportPage } = await import("./page")
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy()
  })

  it("does NOT throw when getExchangeRates rejects", async () => {
    const { default: ReportPage } = await import("./page")
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy()
  })

  it("does NOT throw when computeArbitrageForCar rejects", async () => {
    const { default: ReportPage } = await import("./page")
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy()
  })

  it("keeps the locked preview client for users without access", async () => {
    const { default: ReportPage } = await import("./page")

    const markup = renderToStaticMarkup(await ReportPage({
      params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
      searchParams: Promise.resolve({}),
    }))

    expect(markup).toContain('data-testid="report-client"')
    expect(ReportClientMock).toHaveBeenCalledOnce()
    expect(ReportClientMock.mock.calls[0]?.[0]).toMatchObject({
      userHasAccess: false,
    })
  })

  it("passes unlocked access into the unified report client even before any report exists", async () => {
    const { default: ReportPage } = await import("./page")
    const { createClient } = await import("@/lib/supabase/server")
    const { getUserCredits, hasUnlimitedReportAccess } = await import("@/lib/reports/queries")

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)
    vi.mocked(getUserCredits).mockResolvedValue({
      id: "internal-user-1",
    } as Awaited<ReturnType<typeof getUserCredits>>)
    vi.mocked(hasUnlimitedReportAccess).mockReturnValue(true)

    const markup = renderToStaticMarkup(await ReportPage({
      params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
      searchParams: Promise.resolve({}),
    }))

    expect(markup).toContain('data-testid="report-client"')
    expect(ReportClientMock).toHaveBeenCalledOnce()
    expect(ReportClientMock.mock.calls[0]?.[0]).toMatchObject({
      userHasAccess: true,
      existingReport: null,
      v3Report: null,
    })
  })

  it("passes strict historical comparables and strict live peers to ReportClient", async () => {
    const { default: ReportPage } = await import("./page")
    const { getStrictComparablesForModel } = await import("@/lib/db/queries")
    const { fetchStrictLiveReportPeerCandidates } = await import("@/lib/reportLivePeers")
    const { findStrictReportPeers } = await import("@/lib/similarCars")

    renderToStaticMarkup(await ReportPage({
      params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
      searchParams: Promise.resolve({}),
    }))

    expect(getStrictComparablesForModel).toHaveBeenCalledWith("Porsche", "911")
    expect(fetchStrictLiveReportPeerCandidates).toHaveBeenCalledWith(mockCar)
    expect(findStrictReportPeers).toHaveBeenCalled()
    expect(ReportClientMock.mock.calls[0]?.[0]).toMatchObject({
      dbComparables: [
        expect.objectContaining({ title: "2020 Porsche 911", soldPrice: 100000 }),
      ],
      similarCars: [
        expect.objectContaining({ score: 100, matchReasons: ["Same model variant"] }),
      ],
    })
  })
})

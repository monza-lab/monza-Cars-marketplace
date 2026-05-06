import { describe, it, expect, vi, beforeEach } from "vitest";

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
}));

// Los client components son irrelevantes — sólo nos importa que la
// función ReportPage resuelva sin tirar 500.
vi.mock("./ReportClient", () => ({
  ReportClient: () => null,
}));
vi.mock("./ReportClientV2", () => ({
  ReportClientV2: () => null,
}));

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
}));

vi.mock("@/lib/supabaseLiveListings", () => ({
  fetchLiveListingById: vi.fn().mockResolvedValue(mockCar),
  fetchLiveListingByIdWithStatus: vi.fn().mockResolvedValue({
    car: mockCar,
    transientError: false,
  }),
  fetchLiveListingsAsCollectorCars: vi.fn().mockRejectedValue(new Error("supabase down")),
  fetchPricedListingsForModel: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/exchangeRates", () => ({
  getExchangeRates: vi.fn().mockRejectedValue(new Error("rates api down")),
}));

vi.mock("@/lib/marketIntel/computeArbitrageForCar", () => ({
  computeArbitrageForCar: vi.fn().mockRejectedValue(new Error("arbitrage failed")),
  inferTargetRegion: vi.fn().mockReturnValue("US"),
}));

vi.mock("@/lib/marketStats", () => ({
  computeMarketStatsForCar: vi.fn().mockReturnValue({ marketStats: null }),
}));

vi.mock("@/lib/similarCars", () => ({
  findSimilarCars: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/db/queries", () => ({
  getComparablesForModel: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/reports/queries", () => ({
  getReportForListing: vi.fn().mockResolvedValue(null),
  fetchSignalsForListing: vi.fn().mockResolvedValue([]),
  assembleHausReportFromDB: vi.fn().mockReturnValue(null),
  getReportMetadataV2: vi.fn().mockResolvedValue({ tier: null, report_hash: null, version: null }),
}));

describe("ReportPage SSR robustness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT throw when fetchLiveListingsAsCollectorCars rejects", async () => {
    const { default: ReportPage } = await import("./page");
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });

  it("does NOT throw when getExchangeRates rejects", async () => {
    const { default: ReportPage } = await import("./page");
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });

  it("does NOT throw when computeArbitrageForCar rejects", async () => {
    const { default: ReportPage } = await import("./page");
    await expect(
      ReportPage({
        params: Promise.resolve({ locale: "en", make: "porsche", id: "live-test" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock individual scrapers before importing the orchestrator
vi.mock('@/features/scrapers/auctions/bringATrailer', () => ({
  scrapeBringATrailer: vi.fn(),
}));
vi.mock('@/features/scrapers/auctions/carsAndBids', () => ({
  scrapeCarsAndBids: vi.fn(),
}));
vi.mock('@/features/scrapers/auctions/collectingCars', () => ({
  scrapeCollectingCars: vi.fn(),
}));

import { scrapeAll, scrapePlatform, delay } from '@/features/scrapers/auctions';
import { scrapeBringATrailer } from '@/features/scrapers/auctions/bringATrailer';
import { scrapeCarsAndBids } from '@/features/scrapers/auctions/carsAndBids';
import { scrapeCollectingCars } from '@/features/scrapers/auctions/collectingCars';

const mockBaT = vi.mocked(scrapeBringATrailer);
const mockCaB = vi.mocked(scrapeCarsAndBids);
const mockCC = vi.mocked(scrapeCollectingCars);

function makeFakeAuction(platform: string, id: number) {
  return {
    externalId: `${platform.toLowerCase()}-${id}`,
    platform,
    title: `Test ${platform} ${id}`,
    make: 'Porsche', model: '911', year: 1990,
    mileage: null, mileageUnit: 'miles',
    transmission: null, engine: null,
    exteriorColor: null, interiorColor: null, location: null,
    currentBid: 50000, bidCount: 10,
    endTime: null, url: `https://example.com/${id}`,
    imageUrl: null, description: null, sellerNotes: null,
    status: 'active', vin: null, images: [],
  };
}

// ---------------------------------------------------------------------------
// scrapeAll
// ---------------------------------------------------------------------------
describe('scrapeAll orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaT.mockResolvedValue({
      auctions: [makeFakeAuction('BRING_A_TRAILER', 1)] as any,
      errors: [],
    });
    mockCaB.mockResolvedValue({
      auctions: [makeFakeAuction('CARS_AND_BIDS', 1)] as any,
      errors: [],
    });
    mockCC.mockResolvedValue({
      auctions: [makeFakeAuction('COLLECTING_CARS', 1)] as any,
      errors: [],
    });
  });

  it('aggregates auctions from all three platforms', async () => {
    const result = await scrapeAll();
    expect(result.auctions).toHaveLength(3);
    expect(result.summary.total).toBe(3);
    expect(result.summary.byPlatform.BRING_A_TRAILER).toBe(1);
    expect(result.summary.byPlatform.CARS_AND_BIDS).toBe(1);
    expect(result.summary.byPlatform.COLLECTING_CARS).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('handles one platform failing gracefully', async () => {
    mockCaB.mockRejectedValue(new Error('Network timeout'));

    const result = await scrapeAll();
    expect(result.auctions).toHaveLength(2);
    expect(result.summary.byPlatform.CARS_AND_BIDS).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('CARS_AND_BIDS');
  });

  it('handles all platforms failing', async () => {
    mockBaT.mockRejectedValue(new Error('fail'));
    mockCaB.mockRejectedValue(new Error('fail'));
    mockCC.mockRejectedValue(new Error('fail'));

    const result = await scrapeAll();
    expect(result.auctions).toHaveLength(0);
    expect(result.errors).toHaveLength(3);
  });

  it('records duration in milliseconds', async () => {
    const result = await scrapeAll();
    expect(result.summary.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.summary.durationMs).toBe('number');
  });

  it('passes options through to individual scrapers', async () => {
    const options = { maxPages: 5, scrapeDetails: true, maxDetails: 3 };
    await scrapeAll(options);

    expect(mockBaT).toHaveBeenCalledWith(options);
    expect(mockCaB).toHaveBeenCalledWith(options);
    expect(mockCC).toHaveBeenCalledWith(options);
  });

  it('collects errors from individual scrapers', async () => {
    mockBaT.mockResolvedValue({
      auctions: [makeFakeAuction('BRING_A_TRAILER', 1)] as any,
      errors: ['[BaT] Warning: page structure changed'],
    });

    const result = await scrapeAll();
    expect(result.errors).toContain('[BaT] Warning: page structure changed');
    expect(result.auctions).toHaveLength(3);
  });

  it('handles mixed success and failure', async () => {
    mockBaT.mockResolvedValue({
      auctions: [makeFakeAuction('BRING_A_TRAILER', 1), makeFakeAuction('BRING_A_TRAILER', 2)] as any,
      errors: [],
    });
    mockCaB.mockRejectedValue(new Error('blocked'));
    mockCC.mockResolvedValue({ auctions: [], errors: ['[CC] No cards found'] });

    const result = await scrapeAll();
    expect(result.auctions).toHaveLength(2);
    expect(result.summary.byPlatform.BRING_A_TRAILER).toBe(2);
    expect(result.summary.byPlatform.CARS_AND_BIDS).toBe(0);
    expect(result.summary.byPlatform.COLLECTING_CARS).toBe(0);
    expect(result.errors.length).toBe(2); // C&B failure + CC warning
  });
});

// ---------------------------------------------------------------------------
// scrapePlatform
// ---------------------------------------------------------------------------
describe('scrapePlatform', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBaT.mockResolvedValue({ auctions: [], errors: [] });
    mockCaB.mockResolvedValue({ auctions: [], errors: [] });
    mockCC.mockResolvedValue({ auctions: [], errors: [] });
  });

  it('resolves "BAT" to BringATrailer', async () => {
    await scrapePlatform('BAT');
    expect(mockBaT).toHaveBeenCalled();
  });

  it('resolves "BRING_A_TRAILER" to BringATrailer', async () => {
    await scrapePlatform('BRING_A_TRAILER');
    expect(mockBaT).toHaveBeenCalled();
  });

  it('resolves "CARS_AND_BIDS" to CarsAndBids', async () => {
    await scrapePlatform('CARS_AND_BIDS');
    expect(mockCaB).toHaveBeenCalled();
  });

  it('resolves "CC" to CollectingCars', async () => {
    await scrapePlatform('CC');
    expect(mockCC).toHaveBeenCalled();
  });

  it('resolves "COLLECTING_CARS" to CollectingCars', async () => {
    await scrapePlatform('COLLECTING_CARS');
    expect(mockCC).toHaveBeenCalled();
  });

  it('throws for unknown platform', async () => {
    await expect(scrapePlatform('UNKNOWN')).rejects.toThrow('Unknown platform');
  });

  it('returns auctions array from the scraped platform', async () => {
    mockBaT.mockResolvedValue({
      auctions: [makeFakeAuction('BRING_A_TRAILER', 1)] as any,
      errors: [],
    });

    const auctions = await scrapePlatform('BAT');
    expect(auctions).toHaveLength(1);
    expect(auctions[0].platform).toBe('BRING_A_TRAILER');
  });

  it('resolves "BRINGATRAILER" (without underscore) to BringATrailer', async () => {
    await scrapePlatform('BRINGATRAILER');
    expect(mockBaT).toHaveBeenCalled();
  });

  it('resolves "CAB" to CarsAndBids', async () => {
    await scrapePlatform('CAB');
    expect(mockCaB).toHaveBeenCalled();
  });

  it('resolves "COLLECTINGCARS" to CollectingCars', async () => {
    await scrapePlatform('COLLECTINGCARS');
    expect(mockCC).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// delay helper
// ---------------------------------------------------------------------------
describe('delay helper', () => {
  it('resolves after specified milliseconds', async () => {
    vi.useFakeTimers();
    const promise = delay(100);
    vi.advanceTimersByTime(100);
    await promise;
    vi.useRealTimers();
    // If we get here without timeout, delay resolved correctly
    expect(true).toBe(true);
  });
});

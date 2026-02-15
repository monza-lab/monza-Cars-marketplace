import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeDetail as scrapeBaTDetail } from '@/lib/scrapers/bringATrailer';
import { scrapeDetail as scrapeCaBDetail } from '@/lib/scrapers/carsAndBids';
import { scrapeDetail as scrapeCCDetail } from '@/lib/scrapers/collectingCars';
import type { BaTAuction } from '@/lib/scrapers/bringATrailer';
import type { CaBAuction } from '@/lib/scrapers/carsAndBids';
import type { CCarsAuction } from '@/lib/scrapers/collectingCars';

// ---------------------------------------------------------------------------
// Base auctions
// ---------------------------------------------------------------------------

function makeBaTAuction(overrides: Partial<BaTAuction> = {}): BaTAuction {
  return {
    externalId: 'bat-resilience-test',
    platform: 'BRING_A_TRAILER',
    title: '1990 Porsche 911',
    make: 'Porsche', model: '911', year: 1990,
    mileage: 50000, mileageUnit: 'miles', transmission: 'Manual',
    engine: 'Flat-6', exteriorColor: 'Red', interiorColor: 'Black',
    location: 'NYC', currentBid: 60000, bidCount: 20,
    endTime: null, url: 'https://bringatrailer.com/listing/resilience-test/',
    imageUrl: 'https://img.test/bat.jpg', description: 'Original desc',
    sellerNotes: 'Original notes', status: 'active',
    vin: 'WP0CB2961LS451234', images: ['https://img.test/bat.jpg'],
    reserveStatus: null, bodyStyle: null,
    ...overrides,
  };
}

function makeCaBAuction(overrides: Partial<CaBAuction> = {}): CaBAuction {
  return {
    externalId: 'cab-resilience-test',
    platform: 'CARS_AND_BIDS',
    title: '2023 BMW M3',
    make: 'BMW', model: 'M3', year: 2023,
    mileage: 5000, mileageUnit: 'miles', transmission: 'Auto',
    engine: 'I6 Twin-Turbo', exteriorColor: 'Blue', interiorColor: 'White',
    location: 'LA', currentBid: 80000, bidCount: 30,
    endTime: null, url: 'https://carsandbids.com/auctions/resilience-test',
    imageUrl: 'https://img.test/cab.jpg', description: 'Original desc',
    sellerNotes: 'Original notes', status: 'active',
    vin: 'WBAPH5C50BA123456', images: ['https://img.test/cab.jpg'],
    ...overrides,
  };
}

function makeCCAuction(overrides: Partial<CCarsAuction> = {}): CCarsAuction {
  return {
    externalId: 'cc-resilience-test',
    platform: 'COLLECTING_CARS',
    title: '1992 Porsche 964',
    make: 'Porsche', model: '964', year: 1992,
    mileage: 42000, mileageUnit: 'km', transmission: '5-Speed',
    engine: '3.6L', exteriorColor: 'White', interiorColor: 'Grey',
    location: 'London', currentBid: 185000, bidCount: 18,
    endTime: null, url: 'https://collectingcars.com/cars/resilience-test',
    imageUrl: 'https://img.test/cc.jpg', description: 'Original desc',
    sellerNotes: 'Original notes', status: 'active',
    vin: 'WPOZZZ96ZNS490123', images: ['https://img.test/cc.jpg'],
    ...overrides,
  };
}

// ===========================================================================
// BaT scrapeDetail resilience
// ===========================================================================
describe('BaT: scrapeDetail resilience', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('preserves auction on HTTP 404 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not Found'),
    }));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.externalId).toBe('bat-resilience-test');
    expect(result.mileage).toBe(50000);
    expect(result.transmission).toBe('Manual');
    expect(result.currentBid).toBe(60000);
    expect(result.vin).toBe('WP0CB2961LS451234');
  });

  it('preserves auction on HTTP 500 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server Error'),
    }));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.mileage).toBe(50000);
    expect(result.currentBid).toBe(60000);
  });

  it('preserves auction on HTTP 403 Forbidden', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve('Access denied'),
    }));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.mileage).toBe(50000);
    expect(result.images).toEqual(['https://img.test/bat.jpg']);
  });

  it('preserves auction on network timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Timeout: signal timed out')));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.currentBid).toBe(60000);
    expect(result.description).toBe('Original desc');
  });

  it('preserves auction on AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.externalId).toBe('bat-resilience-test');
    expect(result.mileage).toBe(50000);
  });

  it('handles empty HTML response without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    // Should preserve originals since empty HTML has no matching selectors
    expect(result.mileage).toBe(50000);
    expect(result.images).toEqual(['https://img.test/bat.jpg']);
  });

  it('handles malformed HTML without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><div><<<broken>>>'),
    }));

    const base = makeBaTAuction();
    const promise = scrapeBaTDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.externalId).toBe('bat-resilience-test');
    expect(result.currentBid).toBe(60000);
  });
});

// ===========================================================================
// C&B scrapeDetail resilience
// ===========================================================================
describe('C&B: scrapeDetail resilience', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('preserves auction on HTTP 404 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not Found'),
    }));

    const base = makeCaBAuction();
    const promise = scrapeCaBDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.externalId).toBe('cab-resilience-test');
    expect(result.mileage).toBe(5000);
    expect(result.transmission).toBe('Auto');
    expect(result.currentBid).toBe(80000);
  });

  it('preserves auction on HTTP 500 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Error'),
    }));

    const base = makeCaBAuction();
    const promise = scrapeCaBDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.mileage).toBe(5000);
    expect(result.engine).toBe('I6 Twin-Turbo');
  });

  it('preserves auction on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const base = makeCaBAuction();
    const promise = scrapeCaBDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.currentBid).toBe(80000);
    expect(result.vin).toBe('WBAPH5C50BA123456');
  });

  it('handles empty HTML response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }));

    const base = makeCaBAuction();
    const promise = scrapeCaBDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.mileage).toBe(5000);
    expect(result.images).toEqual(['https://img.test/cab.jpg']);
  });

  it('handles JSON response (wrong content type) without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"error": "not HTML"}'),
    }));

    const base = makeCaBAuction();
    const promise = scrapeCaBDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.currentBid).toBe(80000);
    expect(result.transmission).toBe('Auto');
  });
});

// ===========================================================================
// CC scrapeDetail resilience
// ===========================================================================
describe('CC: scrapeDetail resilience', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('preserves auction on HTTP 404 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not Found'),
    }));

    const base = makeCCAuction();
    const promise = scrapeCCDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.externalId).toBe('cc-resilience-test');
    expect(result.mileage).toBe(42000);
    expect(result.mileageUnit).toBe('km');
    expect(result.currentBid).toBe(185000);
  });

  it('preserves auction on HTTP 500 error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Error'),
    }));

    const base = makeCCAuction();
    const promise = scrapeCCDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.mileage).toBe(42000);
    expect(result.transmission).toBe('5-Speed');
  });

  it('preserves auction on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS lookup failed')));

    const base = makeCCAuction();
    const promise = scrapeCCDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.currentBid).toBe(185000);
    expect(result.location).toBe('London');
    expect(result.vin).toBe('WPOZZZ96ZNS490123');
  });

  it('handles empty HTML response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }));

    const base = makeCCAuction();
    const promise = scrapeCCDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.mileage).toBe(42000);
    expect(result.images).toEqual(['https://img.test/cc.jpg']);
  });

  it('handles redirect page (no useful selectors) without crashing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><head><meta http-equiv="refresh" content="0;url=/login"></head></html>'),
    }));

    const base = makeCCAuction();
    const promise = scrapeCCDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.currentBid).toBe(185000);
    expect(result.exteriorColor).toBe('White');
  });

  it('handles rate-limited response (HTTP 429)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: () => Promise.resolve('Rate limited'),
    }));

    const base = makeCCAuction();
    const promise = scrapeCCDetail(base);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.externalId).toBe('cc-resilience-test');
    expect(result.mileage).toBe(42000);
    expect(result.sellerNotes).toBe('Original notes');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  fetchAuctionData,
  clearCache,
} from '@/features/scrapers/common/scraper';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function mockFetchWith(html: string, options?: { status?: number; ok?: boolean }) {
  const status = options?.status ?? 200;
  const ok = options?.ok ?? true;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Forbidden',
    text: () => Promise.resolve(html),
  }));
}

describe('fetchAuctionData: BringATrailer', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('parses price from BaT HTML', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/test', true);
    expect(result.currentBid).toBe(67500);
  });

  it('parses bid count from BaT HTML', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/test', true);
    expect(result.bidCount).toBe(42);
  });

  it('detects SOLD status', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/test', true);
    expect(result.status).toBe('SOLD');
  });

  it('extracts title', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/test', true);
    expect(result.title).toBe('1990 Porsche 911 Carrera 4');
  });

  it('extracts endTime from data-end-time', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/test', true);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.endTime!.toISOString()).toBe('2025-06-15T18:00:00.000Z');
  });

  it('sets source to bringatrailer', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/test', true);
    expect(result.source).toBe('bringatrailer');
  });
});

describe('fetchAuctionData: BaT ACTIVE status', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('detects ACTIVE status from listing-available indicator', async () => {
    mockFetchWith(loadFixture('zero-cost-bat-active.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/active', true);
    expect(result.status).toBe('ACTIVE');
  });

  it('parses price for active listing', async () => {
    mockFetchWith(loadFixture('zero-cost-bat-active.html'));
    const result = await fetchAuctionData('https://bringatrailer.com/listing/active', true);
    expect(result.currentBid).toBe(85000);
  });
});

describe('fetchAuctionData: RMSothebys', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('parses price from RM Sothebys HTML', async () => {
    mockFetchWith(loadFixture('zero-cost-rms.html'));
    const result = await fetchAuctionData('https://rmsothebys.com/lot/test', true);
    expect(result.currentBid).toBe(2450000);
  });

  it('detects SOLD status', async () => {
    mockFetchWith(loadFixture('zero-cost-rms.html'));
    const result = await fetchAuctionData('https://rmsothebys.com/lot/test', true);
    expect(result.status).toBe('SOLD');
  });

  it('detects NO_SALE status', async () => {
    mockFetchWith(loadFixture('zero-cost-rms-nosale.html'));
    const result = await fetchAuctionData('https://rmsothebys.com/lot/nosale', true);
    expect(result.status).toBe('NO_SALE');
  });

  it('returns bidCount as null (RM does not track)', async () => {
    mockFetchWith(loadFixture('zero-cost-rms.html'));
    const result = await fetchAuctionData('https://rmsothebys.com/lot/test', true);
    expect(result.bidCount).toBeNull();
  });
});

describe('fetchAuctionData: CarsAndBids', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('parses price from C&B HTML', async () => {
    mockFetchWith(loadFixture('zero-cost-cab.html'));
    const result = await fetchAuctionData('https://carsandbids.com/auctions/test', true);
    expect(result.currentBid).toBe(245000);
  });

  it('parses bid count', async () => {
    mockFetchWith(loadFixture('zero-cost-cab.html'));
    const result = await fetchAuctionData('https://carsandbids.com/auctions/test', true);
    expect(result.bidCount).toBe(38);
  });

  it('detects SOLD status', async () => {
    mockFetchWith(loadFixture('zero-cost-cab.html'));
    const result = await fetchAuctionData('https://carsandbids.com/auctions/test', true);
    expect(result.status).toBe('SOLD');
  });

  it('extracts title', async () => {
    mockFetchWith(loadFixture('zero-cost-cab.html'));
    const result = await fetchAuctionData('https://carsandbids.com/auctions/test', true);
    expect(result.title).toBe('2023 Porsche 911 GT3 RS');
  });
});

describe('fetchAuctionData: CollectingCars', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('parses price from CC HTML', async () => {
    mockFetchWith(loadFixture('zero-cost-cc.html'));
    const result = await fetchAuctionData('https://collectingcars.com/cars/test', true);
    expect(result.currentBid).toBe(195000);
  });

  it('detects SOLD status', async () => {
    mockFetchWith(loadFixture('zero-cost-cc.html'));
    const result = await fetchAuctionData('https://collectingcars.com/cars/test', true);
    expect(result.status).toBe('SOLD');
  });

  it('extracts title', async () => {
    mockFetchWith(loadFixture('zero-cost-cc.html'));
    const result = await fetchAuctionData('https://collectingcars.com/cars/test', true);
    expect(result.title).toBe('1992 Porsche 964 Carrera RS');
  });

  it('stores rawPriceText', async () => {
    mockFetchWith(loadFixture('zero-cost-cc.html'));
    const result = await fetchAuctionData('https://collectingcars.com/cars/test', true);
    expect(result.rawPriceText).toBe('£195,000');
  });
});

describe('fetchAuctionData: unknown platform', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('uses generic fallback for unknown platform', async () => {
    mockFetchWith('<html><body><div class="price">$99,000</div><h1>Some Car</h1></body></html>');
    const result = await fetchAuctionData('https://example.com/car/1', true);
    expect(result.currentBid).toBe(99000);
    expect(result.title).toBe('Some Car');
    expect(result.source).toBe('unknown');
  });

  it('handles empty HTML page', async () => {
    mockFetchWith('<html><body></body></html>');
    const result = await fetchAuctionData('https://example.com/car/2', true);
    expect(result.currentBid).toBeNull();
    expect(result.title).toBeNull();
  });

  it('returns default response on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await fetchAuctionData('https://example.com/fail', true);
    expect(result.currentBid).toBeNull();
    expect(result.status).toBeNull();
    expect(result.source).toBe('unknown');
  });
});

describe('fetchAuctionData: HTTP errors', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns default response on 403 status', async () => {
    mockFetchWith('Forbidden', { status: 403, ok: false });
    const result = await fetchAuctionData('https://bringatrailer.com/listing/blocked', true);
    expect(result.currentBid).toBeNull();
    expect(result.status).toBeNull();
  });

  it('returns default response on 500 status', async () => {
    mockFetchWith('Server Error', { status: 500, ok: false });
    const result = await fetchAuctionData('https://bringatrailer.com/listing/error', true);
    expect(result.currentBid).toBeNull();
  });
});

describe('fetchAuctionData: cache behavior', () => {
  beforeEach(() => { clearCache(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns cached data on second call (cache HIT)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(loadFixture('zero-cost-bat.html')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://bringatrailer.com/listing/cache-test';
    const result1 = await fetchAuctionData(url, true); // force first fetch
    const result2 = await fetchAuctionData(url, false); // should use cache

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result2.currentBid).toBe(result1.currentBid);
  });

  it('bypasses cache when forceRefresh=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve(loadFixture('zero-cost-bat.html')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://bringatrailer.com/listing/force-test';
    await fetchAuctionData(url, true);
    await fetchAuctionData(url, true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sets scrapedAt timestamp', async () => {
    mockFetchWith(loadFixture('zero-cost-bat.html'));
    const before = new Date();
    const result = await fetchAuctionData('https://bringatrailer.com/listing/time', true);
    const after = new Date();
    expect(result.scrapedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.scrapedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

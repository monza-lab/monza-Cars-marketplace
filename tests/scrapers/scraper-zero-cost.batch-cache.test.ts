import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchAuctionData,
  batchFetchAuctionData,
  cleanCache,
  getCacheStats,
  clearCache,
  getCachedData,
  detectPlatform,
} from '@/lib/scraper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBaTHtml(bid: string, title: string): string {
  return `<html><body>
    <h1 class="post-title">${title}</h1>
    <div class="listing-bid-value">${bid}</div>
    <div class="listing-stats"><span class="number-bids-value">15</span></div>
    <div class="listing-available">Active</div>
  </body></html>`;
}

function makeCaBHtml(bid: string, title: string): string {
  return `<html><body>
    <h1 class="auction-title">${title}</h1>
    <div class="auction-price">${bid}</div>
    <div class="bid-count">20 bids</div>
    <div class="auction-active">Active</div>
  </body></html>`;
}

function makeCCHtml(bid: string, title: string): string {
  return `<html><body>
    <h1 class="lot-title">${title}</h1>
    <div class="current-bid">${bid}</div>
    <div class="live">Active</div>
  </body></html>`;
}

function makeGenericHtml(bid: string, title: string): string {
  return `<html><body>
    <h1>${title}</h1>
    <div class="price-tag">${bid}</div>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// batchFetchAuctionData
// ---------------------------------------------------------------------------
describe('Zero-cost scraper: batchFetchAuctionData', () => {
  beforeEach(() => {
    clearCache();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      let html: string;
      if (url.includes('bringatrailer.com')) {
        html = makeBaTHtml('$55,000', '1990 Porsche 911');
      } else if (url.includes('carsandbids.com')) {
        html = makeCaBHtml('$120,000', '2023 BMW M3');
      } else if (url.includes('collectingcars.com')) {
        html = makeCCHtml('£90,000', '1992 Porsche 964');
      } else {
        html = makeGenericHtml('$10,000', 'Unknown Car');
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('fetches multiple URLs and returns results map', async () => {
    const urls = [
      'https://bringatrailer.com/listing/1990-porsche-911/',
      'https://carsandbids.com/auctions/2023-bmw-m3',
    ];

    const results = await batchFetchAuctionData(urls, 0); // 0 delay for speed

    expect(results.size).toBe(2);
    expect(results.has(urls[0])).toBe(true);
    expect(results.has(urls[1])).toBe(true);

    const batResult = results.get(urls[0])!;
    expect(batResult.currentBid).toBe(55000);
    expect(batResult.source).toBe('bringatrailer');

    const cabResult = results.get(urls[1])!;
    expect(cabResult.currentBid).toBe(120000);
    expect(cabResult.source).toBe('carsandbids');
  });

  it('handles empty URL array', async () => {
    const results = await batchFetchAuctionData([], 0);
    expect(results.size).toBe(0);
  });

  it('handles single URL', async () => {
    const urls = ['https://collectingcars.com/cars/1992-porsche-964'];
    const results = await batchFetchAuctionData(urls, 0);

    expect(results.size).toBe(1);
    const data = results.get(urls[0])!;
    expect(data.currentBid).toBe(90000);
    expect(data.source).toBe('collectingcars');
  });

  it('handles fetch errors gracefully for individual URLs', async () => {
    (globalThis.fetch as any).mockImplementation((url: string) => {
      if (url.includes('error-url')) {
        return Promise.reject(new Error('Connection refused'));
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(makeBaTHtml('$55,000', 'Good Car')),
      });
    });

    const urls = [
      'https://bringatrailer.com/listing/good-car/',
      'https://error-url.com/listing/bad/',
    ];

    const results = await batchFetchAuctionData(urls, 0);

    expect(results.size).toBe(2);
    // Good URL should have data
    const good = results.get(urls[0])!;
    expect(good.currentBid).toBe(55000);
    // Bad URL should have default response (nulls)
    const bad = results.get(urls[1])!;
    expect(bad.currentBid).toBeNull();
  });

  it('caches results from batch for subsequent requests', async () => {
    const url = 'https://bringatrailer.com/listing/cache-test/';
    await batchFetchAuctionData([url], 0);

    // Should now be cached
    const cached = getCachedData(url);
    expect(cached).not.toBeNull();
    expect(cached!.currentBid).toBe(55000);
  });
});

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------
describe('Zero-cost scraper: cache management', () => {
  beforeEach(() => {
    clearCache();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(makeBaTHtml('$75,000', 'Cached Car')),
      });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('getCacheStats returns empty stats initially', () => {
    const stats = getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.oldestEntry).toBeNull();
    expect(stats.newestEntry).toBeNull();
  });

  it('getCacheStats reflects cached entries', async () => {
    await fetchAuctionData('https://bringatrailer.com/listing/test-1/');
    await fetchAuctionData('https://bringatrailer.com/listing/test-2/');

    const stats = getCacheStats();
    expect(stats.size).toBe(2);
    expect(stats.oldestEntry).toBeInstanceOf(Date);
    expect(stats.newestEntry).toBeInstanceOf(Date);
  });

  it('clearCache removes all entries', async () => {
    await fetchAuctionData('https://bringatrailer.com/listing/clear-test/');
    expect(getCacheStats().size).toBe(1);

    clearCache();
    expect(getCacheStats().size).toBe(0);
  });

  it('getCachedData returns null for uncached URL', () => {
    expect(getCachedData('https://bringatrailer.com/not-cached')).toBeNull();
  });

  it('getCachedData returns data for cached URL', async () => {
    const url = 'https://bringatrailer.com/listing/cached-car/';
    await fetchAuctionData(url);

    const cached = getCachedData(url);
    expect(cached).not.toBeNull();
    expect(cached!.source).toBe('bringatrailer');
    expect(cached!.currentBid).toBe(75000);
  });

  it('fetchAuctionData uses cache on second call', async () => {
    const url = 'https://bringatrailer.com/listing/cache-hit/';

    await fetchAuctionData(url);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second call should be from cache — no additional fetch
    const result = await fetchAuctionData(url);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // still 1
    expect(result.currentBid).toBe(75000);
  });

  it('fetchAuctionData bypasses cache with forceRefresh', async () => {
    const url = 'https://bringatrailer.com/listing/force-refresh/';

    await fetchAuctionData(url);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await fetchAuctionData(url, true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('cleanCache removes expired entries', async () => {
    const url = 'https://bringatrailer.com/listing/expire-test/';
    await fetchAuctionData(url);

    expect(getCacheStats().size).toBe(1);

    // cleanCache should NOT remove it since it's fresh
    const removed = cleanCache();
    expect(removed).toBe(0);
    expect(getCacheStats().size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Generic/unknown platform fallback
// ---------------------------------------------------------------------------
describe('Zero-cost scraper: generic platform fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('parses generic page with price class', async () => {
    const html = `<html><body>
      <h1>Rare Vintage Car</h1>
      <div class="price">$150,000</div>
    </body></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }));

    const result = await fetchAuctionData('https://unknown-site.com/car/123');
    expect(result.source).toBe('unknown');
    expect(result.title).toBe('Rare Vintage Car');
    expect(result.currentBid).toBe(150000);
  });

  it('returns default response for HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    const result = await fetchAuctionData('https://bringatrailer.com/listing/not-found/');
    expect(result.currentBid).toBeNull();
    expect(result.title).toBeNull();
    expect(result.source).toBe('bringatrailer');
    expect(result.scrapedAt).toBeInstanceOf(Date);
  });

  it('returns default response for network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await fetchAuctionData('https://carsandbids.com/auctions/fail');
    expect(result.currentBid).toBeNull();
    expect(result.title).toBeNull();
    expect(result.source).toBe('carsandbids');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scrapeBringATrailer,
  scrapeListings,
  scrapeDetail,
} from '@/lib/scrapers/bringATrailer';
import type { BaTAuction } from '@/lib/scrapers/bringATrailer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBaTListingPage(cards: string[]): string {
  return `<html><body><div class="auctions-list">${cards.join('\n')}</div></body></html>`;
}

function makeBaTCard(slug: string, title: string, price: string, bids: number): string {
  return `
    <article class="auction-item">
      <a href="/listing/${slug}/">
        <img src="https://cdn.bringatrailer.com/img/${slug}.jpg" />
      </a>
      <h3 class="auction-title">${title}</h3>
      <div class="auction-bid">${price}</div>
      <div class="bid-count">${bids} Bids</div>
      <time datetime="2025-06-15T18:00:00Z" class="auction-end">Jun 15</time>
    </article>`;
}

function makeDetailPage(overrides: Record<string, string> = {}): string {
  const mileage = overrides.mileage ?? '55,000';
  const transmission = overrides.transmission ?? 'Manual';
  const engine = overrides.engine ?? '3.6L Flat-6';
  const exterior = overrides.exterior ?? 'Red';
  const interior = overrides.interior ?? 'Black';
  const location = overrides.location ?? 'Austin, TX';
  const vin = overrides.vin ?? 'WP0CB2961LS999888';
  const bid = overrides.bid ?? '$60,000';
  const bidCount = overrides.bidCount ?? '35';

  return `<html><body>
    <div class="post-excerpt">Detailed description of auction</div>
    <div class="seller_note">Seller notes here</div>
    <ul class="essentials">
      <li>Miles: ${mileage}</li>
      <li>Transmission: ${transmission}</li>
      <li>Engine: ${engine}</li>
      <li>Exterior Color: ${exterior}</li>
      <li>Interior Color: ${interior}</li>
      <li>Location: ${location}</li>
      <li>VIN: ${vin}</li>
    </ul>
    <div class="gallery">
      <img src="https://img.test/detail1.jpg" />
      <img src="https://img.test/detail2.jpg" />
    </div>
    <div class="current-bid">${bid}</div>
    <div class="bid-count">${bidCount} bids</div>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// scrapeBringATrailer entry point
// ---------------------------------------------------------------------------
describe('BaT: scrapeBringATrailer entry point', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns listings without detail scraping by default', async () => {
    const listingPage = makeBaTListingPage([
      makeBaTCard('car-a', '1990 Porsche 911', '$50,000', 15),
      makeBaTCard('car-b', '1985 BMW M3', '$40,000', 12),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(listingPage),
    }));

    const promise = scrapeBringATrailer({ maxPages: 1 });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(2);
    // Detail fields should be null since scrapeDetails defaults to false
    expect(auctions[0].description).toBeNull();
    expect(auctions[0].transmission).toBeNull();
    expect(auctions[0].engine).toBeNull();
  });

  it('enriches auctions with detail data when scrapeDetails is true', async () => {
    const listingPage = makeBaTListingPage([
      makeBaTCard('1990-porsche-911', '1990 Porsche 911', '$50,000', 15),
    ]);
    const detailPage = makeDetailPage();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/listing/1990-porsche-911') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 10,
    });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(1);
    expect(auctions[0].mileage).toBe(55000);
    expect(auctions[0].transmission).toBe('Manual');
    expect(auctions[0].engine).toBe('3.6L Flat-6');
    expect(auctions[0].vin).toBe('WP0CB2961LS999888');
    expect(auctions[0].images).toHaveLength(2);
  });

  it('respects maxDetails limit', async () => {
    const listingPage = makeBaTListingPage([
      makeBaTCard('car-a', '1990 Porsche 911', '$50,000', 15),
      makeBaTCard('car-b', '1985 BMW M3', '$40,000', 12),
      makeBaTCard('car-c', '2000 Honda S2000', '$25,000', 8),
    ]);
    const detailPage = makeDetailPage();

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      // Listing page URL vs detail page URL
      const html = url.includes('/listing/car-') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    }));

    const promise = scrapeBringATrailer({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 1, // Only scrape 1 detail page
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(3);
    // First auction should be enriched
    expect(auctions[0].mileage).toBe(55000);
    // Remaining auctions should NOT be enriched
    expect(auctions[1].mileage).toBeNull();
    expect(auctions[2].mileage).toBeNull();
  });

  it('accumulates errors from failed detail pages', async () => {
    const listingPage = makeBaTListingPage([
      makeBaTCard('car-ok', '1990 Porsche 911', '$50,000', 15),
      makeBaTCard('car-fail', '1985 BMW M3', '$40,000', 12),
    ]);

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      callCount++;
      // First call: listing page, second call: first detail (ok), third call: second detail (fail)
      if (url.includes('/listing/car-fail')) {
        return Promise.reject(new Error('Connection refused'));
      }
      if (url.includes('/listing/car-ok')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(makeDetailPage()),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(listingPage),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 10,
    });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(2);
    // The failed detail should not crash — auction preserves listing data
    expect(auctions[0].mileage).toBe(55000); // enriched
    expect(auctions[1].mileage).toBeNull(); // preserved from listing
  });

  it('skips detail scraping when listings return 0 auctions', async () => {
    const emptyPage = '<html><body><div></div></body></html>';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(emptyPage),
    }));

    const promise = scrapeBringATrailer({
      maxPages: 1,
      scrapeDetails: true,
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(0);
    // fetch should only be called once (listing page), not for details
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

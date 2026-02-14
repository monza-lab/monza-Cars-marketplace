import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeCarsAndBids } from '@/lib/scrapers/carsAndBids';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCaBListingPage(cards: string[]): string {
  return `<html><body><div class="auctions-list">${cards.join('\n')}</div></body></html>`;
}

function makeCaBCard(slug: string, title: string, price: string, bids: number): string {
  return `
    <div class="auction-card">
      <a href="/auctions/${slug}">
        <img src="https://cdn.carsandbids.com/img/${slug}.jpg" />
      </a>
      <h3 class="auction-title">${title}</h3>
      <div class="current-bid">${price}</div>
      <div class="bid-count">${bids} Bids</div>
      <time datetime="2025-07-01T20:00:00Z" class="time-left">Jul 1</time>
      <div class="stats">15,000 miles</div>
    </div>`;
}

function makeCaBDetailPage(): string {
  return `<html><body>
    <div class="auction-description">Beautiful low-mileage example</div>
    <div class="seller-notes">One careful owner</div>
    <dl>
      <dt>Mileage</dt><dd>12,000 miles</dd>
      <dt>Transmission</dt><dd>6-Speed Manual</dd>
      <dt>Engine</dt><dd>4.0L V8</dd>
      <dt>Exterior Color</dt><dd>Silver</dd>
      <dt>Interior Color</dt><dd>Tan Leather</dd>
      <dt>Location</dt><dd>Miami, FL</dd>
      <dt>VIN</dt><dd>WBAPH5C50BA123456</dd>
    </dl>
    <div class="gallery">
      <img src="https://img.test/cab-1.jpg" />
      <img src="https://img.test/cab-2.jpg" />
    </div>
    <div class="current-bid">$95,000</div>
    <div class="bid-count">42 bids</div>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// scrapeCarsAndBids entry point
// ---------------------------------------------------------------------------
describe('C&B: scrapeCarsAndBids entry point', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns listings without detail scraping by default', async () => {
    const listingPage = makeCaBListingPage([
      makeCaBCard('2023-porsche-gt3', '2023 Porsche 911 GT3', '$200,000', 40),
      makeCaBCard('2021-bmw-m5', '2021 BMW M5 CS', '$120,000', 30),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(listingPage),
    }));

    const promise = scrapeCarsAndBids({ maxPages: 1 });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(2);
    expect(auctions[0].description).toBeNull();
    expect(auctions[0].transmission).toBeNull();
  });

  it('enriches auctions with detail data when scrapeDetails is true', async () => {
    const listingPage = makeCaBListingPage([
      makeCaBCard('2021-bmw-m3', '2021 BMW M3 Competition', '$85,000', 25),
    ]);
    const detailPage = makeCaBDetailPage();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/auctions/2021-bmw-m3') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCarsAndBids({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 10,
    });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(1);
    expect(auctions[0].mileage).toBe(12000);
    expect(auctions[0].transmission).toBe('6-Speed Manual');
    expect(auctions[0].engine).toBe('4.0L V8');
    expect(auctions[0].vin).toBe('WBAPH5C50BA123456');
    expect(auctions[0].images).toHaveLength(2);
  });

  it('respects maxDetails limit', async () => {
    const listingPage = makeCaBListingPage([
      makeCaBCard('car-a', '2023 Porsche 911 GT3', '$200,000', 40),
      makeCaBCard('car-b', '2021 BMW M5 CS', '$120,000', 30),
      makeCaBCard('car-c', '2022 Audi RS6', '$110,000', 22),
    ]);
    const detailPage = makeCaBDetailPage();

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      // Listing page URL vs detail page URL
      const html = url.includes('/auctions/car-') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    }));

    const promise = scrapeCarsAndBids({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 2,
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(3);
    // First two should be enriched, third should not
    expect(auctions[0].transmission).toBe('6-Speed Manual');
    expect(auctions[1].transmission).toBe('6-Speed Manual');
    expect(auctions[2].transmission).toBeNull();
  });

  it('accumulates errors from failed detail pages without crashing', async () => {
    const listingPage = makeCaBListingPage([
      makeCaBCard('car-ok', '2023 Porsche 911', '$200,000', 40),
      makeCaBCard('car-fail', '2021 BMW M5', '$120,000', 30),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auctions/car-fail')) {
        return Promise.reject(new Error('Timeout'));
      }
      if (url.includes('/auctions/car-ok')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(makeCaBDetailPage()),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(listingPage),
      });
    }));

    const promise = scrapeCarsAndBids({
      maxPages: 1,
      scrapeDetails: true,
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(2);
    expect(auctions[0].transmission).toBe('6-Speed Manual');
    expect(auctions[1].transmission).toBeNull(); // preserved
  });
});

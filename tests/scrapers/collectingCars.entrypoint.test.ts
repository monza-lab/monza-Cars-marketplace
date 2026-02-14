import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrapeCollectingCars } from '@/lib/scrapers/collectingCars';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCCListingPage(cards: string[]): string {
  return `<html><body><div class="page-content">${cards.join('\n')}</div></body></html>`;
}

function makeCCCard(slug: string, title: string, price: string, bids: number): string {
  return `
    <div class="lot-card">
      <a href="/cars/${slug}">
        <img src="https://cdn.collectingcars.com/img/${slug}.jpg" />
      </a>
      <h3 class="lot-title">${title}</h3>
      <div class="current-bid">${price}</div>
      <div class="bid-count">${bids} Bids</div>
      <time datetime="2025-06-20T14:00:00Z" class="countdown">Jun 20</time>
      <span class="lot-location">London, UK</span>
      <div class="stats">25,000 km</div>
    </div>`;
}

function makeCCDetailPage(): string {
  return `<html><body>
    <div class="lot-description">Exceptional original example</div>
    <div class="seller_note">Full service history</div>
    <ul class="lot-details">
      <li>Kilometres: 42,000 km</li>
      <li>Gearbox: 5-Speed Manual</li>
      <li>Engine: 3.6L Flat-6</li>
      <li>Exterior Colour: Signal Green</li>
      <li>Interior Colour: Black Leather</li>
      <li>Location: Paris, France</li>
      <li>Chassis Number: WPOZZZ96ZNS490777</li>
    </ul>
    <div class="gallery">
      <img src="https://img.test/cc-1.jpg" />
      <img src="https://img.test/cc-2.jpg" />
      <img src="https://img.test/cc-3.jpg" />
    </div>
    <div class="current-bid">£210,000</div>
    <div class="bid-count">28 bids</div>
  </body></html>`;
}

// ---------------------------------------------------------------------------
// scrapeCollectingCars entry point
// ---------------------------------------------------------------------------
describe('CC: scrapeCollectingCars entry point', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns listings without detail scraping by default', async () => {
    const listingPage = makeCCListingPage([
      makeCCCard('1992-porsche-964-rs', '1992 Porsche 964 Carrera RS', '£185,000', 18),
      makeCCCard('1973-ferrari-dino', '1973 Ferrari Dino 246 GTS', '£320,000', 25),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(listingPage),
    }));

    const promise = scrapeCollectingCars({ maxPages: 1 });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(2);
    expect(auctions[0].description).toBeNull();
    expect(auctions[0].transmission).toBeNull();
  });

  it('enriches auctions with detail data when scrapeDetails is true', async () => {
    const listingPage = makeCCListingPage([
      makeCCCard('1992-porsche-964', '1992 Porsche 964 Carrera RS', '£185,000', 18),
    ]);
    const detailPage = makeCCDetailPage();

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/cars/1992-porsche-964') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    }));

    const promise = scrapeCollectingCars({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 10,
    });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(1);
    expect(auctions[0].mileage).toBe(42000);
    expect(auctions[0].mileageUnit).toBe('km');
    expect(auctions[0].transmission).toBe('5-Speed Manual');
    expect(auctions[0].engine).toBe('3.6L Flat-6');
    expect(auctions[0].images).toHaveLength(3);
    expect(auctions[0].description).toContain('Exceptional');
  });

  it('respects maxDetails limit', async () => {
    const listingPage = makeCCListingPage([
      makeCCCard('car-a', '1992 Porsche 964 RS', '£185,000', 18),
      makeCCCard('car-b', '1973 Ferrari Dino', '£320,000', 25),
      makeCCCard('car-c', '1990 BMW E30 M3', '£120,000', 14),
    ]);
    const detailPage = makeCCDetailPage();

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      // Listing page URL vs detail page URL
      const html = url.includes('/cars/car-') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    }));

    const promise = scrapeCollectingCars({
      maxPages: 1,
      scrapeDetails: true,
      maxDetails: 1,
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(3);
    // Only first should be enriched
    expect(auctions[0].transmission).toBe('5-Speed Manual');
    expect(auctions[1].transmission).toBeNull();
    expect(auctions[2].transmission).toBeNull();
  });

  it('accumulates errors from failed detail pages without crashing', async () => {
    const listingPage = makeCCListingPage([
      makeCCCard('car-ok', '1992 Porsche 964', '£185,000', 18),
      makeCCCard('car-fail', '1973 Ferrari Dino', '£320,000', 25),
    ]);

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/cars/car-fail')) {
        return Promise.reject(new Error('DNS lookup failed'));
      }
      if (url.includes('/cars/car-ok')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(makeCCDetailPage()),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(listingPage),
      });
    }));

    const promise = scrapeCollectingCars({
      maxPages: 1,
      scrapeDetails: true,
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(2);
    expect(auctions[0].transmission).toBe('5-Speed Manual');
    expect(auctions[1].transmission).toBeNull(); // preserved
  });

  it('handles CC-specific British spelling in detail specs', async () => {
    const listingPage = makeCCListingPage([
      makeCCCard('1990-bmw-m3', '1990 BMW E30 M3', '£120,000', 14),
    ]);
    // CC detail page with "colour" and "kilometres" (British spellings)
    const detailPage = `<html><body>
      <div class="lot-description">Right-hand drive example</div>
      <ul class="lot-details">
        <li>Kilometres: 78,500 km</li>
        <li>Gearbox: Dog-Leg 5-Speed</li>
        <li>Engine Size: 2.3L S14</li>
        <li>Exterior Colour: Alpine White</li>
        <li>Interior Colour: Anthracite Cloth</li>
        <li>Country: Germany</li>
        <li>Chassis Number: WBSAK0308LAE40555</li>
      </ul>
      <div class="gallery">
        <img src="https://img.test/m3-1.jpg" />
      </div>
      <div class="current-bid">£130,000</div>
      <div class="bid-count">19 bids</div>
    </body></html>`;

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/cars/1990-bmw-m3') ? detailPage : listingPage;
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(html),
      });
    }));

    const promise = scrapeCollectingCars({
      maxPages: 1,
      scrapeDetails: true,
    });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].mileage).toBe(78500);
    expect(auctions[0].mileageUnit).toBe('km');
    expect(auctions[0].transmission).toBe('Dog-Leg 5-Speed');
    expect(auctions[0].exteriorColor).toBe('Alpine White');
    expect(auctions[0].interiorColor).toBe('Anthracite Cloth');
    expect(auctions[0].location).toBe('Germany');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scrapeListings,
  scrapeDetail,
  scrapeCollectingCars,
} from '@/features/scrapers/auctions/collectingCars';
import type { CCarsAuction } from '@/features/scrapers/auctions/collectingCars';

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

function makeCCFallbackPage(cards: string[]): string {
  return `<html><body><ul>${cards.join('\n')}</ul></body></html>`;
}

function makeCCFallbackCard(slug: string, title: string, urlType: 'cars' | 'lots' = 'cars'): string {
  return `
    <li>
      <a href="/${urlType}/${slug}">${title}</a>
      <div class="current-bid">£50,000</div>
      <div class="bid-count">10 Bids</div>
    </li>`;
}

// ---------------------------------------------------------------------------
// scrapeListings
// ---------------------------------------------------------------------------
describe('CC: scrapeListings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scrapes 2 auctions from page with primary selectors', async () => {
    const page1 = makeCCListingPage([
      makeCCCard('1992-porsche-964-rs', '1992 Porsche 964 Carrera RS', '£185,000', 18),
      makeCCCard('1973-ferrari-dino', '1973 Ferrari Dino 246 GTS', '£320,000', 25),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page1),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(2);
    expect(auctions[0].title).toBe('1992 Porsche 964 Carrera RS');
    expect(auctions[0].currentBid).toBe(185000);
    expect(auctions[0].platform).toBe('COLLECTING_CARS');
    expect(auctions[1].title).toBe('1973 Ferrari Dino 246 GTS');
  });

  it('uses correct pagination URL for page 2+', async () => {
    const page = makeCCListingPage([
      makeCCCard('car-a', '2000 Porsche Boxster S', '£25,000', 8),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeListings(2);
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchMock).toHaveBeenCalledWith(
      'https://collectingcars.com/search',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://collectingcars.com/search?page=2',
      expect.anything(),
    );
  });

  it('falls back to a[href*="/cars/"] selectors when primary returns empty', async () => {
    const page1 = makeCCFallbackPage([
      makeCCFallbackCard('fallback-car', '1987 Ferrari F40'),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page1),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('1987 Ferrari F40');
  });

  it('handles /lots/ URL pattern in fallback', async () => {
    const page1 = makeCCFallbackPage([
      makeCCFallbackCard('lot-car', '1965 Shelby Cobra', 'lots'),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page1),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].url).toContain('/lots/lot-car');
    expect(auctions[0].externalId).toMatch(/^cc-lot-car/);
  });

  it('records error and breaks when page 1 has no cards at all', async () => {
    const emptyPage = '<html><body><div>Nothing here</div></body></html>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(emptyPage),
    }));

    const promise = scrapeListings(2);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain('No auction cards found');
  });

  it('stops entirely when page 1 fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const promise = scrapeListings(3);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain('Error scraping page 1');
  });

  it('preserves page 1 results when page 2 fetch fails', async () => {
    const page = makeCCListingPage([
      makeCCCard('good-car', '1990 Jaguar XJ220', '£450,000', 30),
    ]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('page=2')) return Promise.reject(new Error('Timeout'));
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(page),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeListings(2);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('1990 Jaguar XJ220');
    expect(errors.some(e => e.includes('page 2'))).toBe(true);
  });

  it('parses mileage in km from card stats', async () => {
    const page = makeCCListingPage([
      makeCCCard('km-test', '2015 BMW M4 GTS', '£65,000', 12),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions[0].mileage).toBe(25000);
    expect(auctions[0].mileageUnit).toBe('km');
  });

  it('extracts location from lot-location element', async () => {
    const page = makeCCListingPage([
      makeCCCard('loc-test', '2018 McLaren 720S', '£180,000', 20),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions[0].location).toBe('London, UK');
  });

  it('generates correct auction shape', async () => {
    const page = makeCCListingPage([
      makeCCCard('shape-test', '1996 Porsche 911 (993) Turbo - 1996', '£150,000', 35),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    const a = auctions[0];
    expect(a.externalId).toMatch(/^cc-shape-test/);
    expect(a.platform).toBe('COLLECTING_CARS');
    expect(a.make).toBe('Porsche');
    expect(a.url).toContain('/cars/shape-test');
    expect(a.imageUrl).toContain('shape-test.jpg');
    expect(a.status).toBe('active');
    expect(a.transmission).toBeNull();
    expect(a.endTime).toBeInstanceOf(Date);
  });

  it('maxPages=0 returns empty', async () => {
    const promise = scrapeListings(0);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scrapeCollectingCars (main entry)
// ---------------------------------------------------------------------------
describe('CC: scrapeCollectingCars', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses default options (maxPages=2, no details)', async () => {
    const page = makeCCListingPage([
      makeCCCard('entry-test', '1988 Porsche 959', '£900,000', 45),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCollectingCars();
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions.length).toBeGreaterThanOrEqual(1);
    expect(fetchMock.mock.calls.length).toBe(2); // default maxPages=2
  });

  it('scrapes details when scrapeDetails=true', async () => {
    const listPage = makeCCListingPage([
      makeCCCard('detail-test', '1985 Ferrari 288 GTO', '£2,500,000', 50),
    ]);
    const detailPage = `<html><body>
      <div class="lot-description">Exceptional collector car with provenance</div>
      <ul class="lot-details">
        <li>Mileage: 12,000 km</li>
        <li>Transmission: 5-Speed Manual</li>
        <li>Exterior Colour: Rosso Corsa</li>
      </ul>
      <div class="current-bid">£2,600,000</div>
    </body></html>`;

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/cars/detail-test') ? detailPage : listPage;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCollectingCars({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].description).toContain('Exceptional collector car');
    expect(auctions[0].mileage).toBe(12000);
    expect(auctions[0].mileageUnit).toBe('km');
    expect(auctions[0].transmission).toBe('5-Speed Manual');
    expect(auctions[0].exteriorColor).toBe('Rosso Corsa');
    expect(auctions[0].currentBid).toBe(2600000);
  });

  it('handles detail page error gracefully', async () => {
    const listPage = makeCCListingPage([
      makeCCCard('err-detail', '1990 Lotus Esprit', '£45,000', 10),
    ]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/cars/err-detail')) {
        return Promise.reject(new Error('Detail fetch failed'));
      }
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(listPage),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCollectingCars({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('1990 Lotus Esprit');
    expect(auctions[0].currentBid).toBe(45000);
  });

  it('respects maxPages option', async () => {
    const page = makeCCListingPage([
      makeCCCard('mp', '2020 Alpine A110', '£45,000', 15),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCollectingCars({ maxPages: 1 });
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respects maxDetails option', async () => {
    const listPage = makeCCListingPage([
      makeCCCard('d1', '2020 Porsche Taycan', '£80,000', 20),
      makeCCCard('d2', '2021 BMW iX', '£60,000', 15),
      makeCCCard('d3', '2022 Mercedes EQS', '£90,000', 25),
    ]);
    const detailPage = '<html><body><div class="lot-description">Detail</div></body></html>';
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/cars/d') ? detailPage : listPage;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCollectingCars({ maxPages: 1, scrapeDetails: true, maxDetails: 2 });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(3);
    // Listing fetch + 2 detail fetches = 3 calls
    const detailCalls = fetchMock.mock.calls.filter(
      (call: any[]) => call[0].includes('/cars/d') && !call[0].includes('search')
    );
    expect(detailCalls).toHaveLength(2);
  });

  it('skips details when listings are empty', async () => {
    const emptyPage = '<html><body></body></html>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(emptyPage),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCollectingCars({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

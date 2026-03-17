import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scrapeListings,
  scrapeDetail,
  scrapeCarsAndBids,
} from '@/features/scrapers/auctions/carsAndBids';
import type { CaBAuction } from '@/features/scrapers/auctions/carsAndBids';

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

function makeCaBFallbackPage(cards: string[]): string {
  return `<html><body><ul>${cards.join('\n')}</ul></body></html>`;
}

function makeCaBFallbackCard(slug: string, title: string): string {
  return `
    <li>
      <a href="/auctions/${slug}">${title}</a>
      <div class="current-bid">$50,000</div>
      <div class="bid-count">10 Bids</div>
    </li>`;
}

// ---------------------------------------------------------------------------
// scrapeListings
// ---------------------------------------------------------------------------
describe('C&B: scrapeListings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scrapes 2 auctions from page with primary selectors', async () => {
    const page1 = makeCaBListingPage([
      makeCaBCard('2023-porsche-911-gt3', '2023 Porsche 911 GT3', '$200,000', 40),
      makeCaBCard('2022-bmw-m4', '2022 BMW M4 Competition', '$65,000', 22),
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
    expect(auctions[0].title).toBe('2023 Porsche 911 GT3');
    expect(auctions[0].currentBid).toBe(200000);
    expect(auctions[0].platform).toBe('CARS_AND_BIDS');
    expect(auctions[1].title).toBe('2022 BMW M4 Competition');
  });

  it('uses correct pagination URL (no slash before ?)', async () => {
    const page = makeCaBListingPage([
      makeCaBCard('car-a', '2000 Honda S2000', '$35,000', 18),
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
      'https://carsandbids.com/auctions',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://carsandbids.com/auctions?page=2',
      expect.anything(),
    );
  });

  it('falls back to a[href*="/auctions/"] selectors when primary returns empty', async () => {
    const page1 = makeCaBFallbackPage([
      makeCaBFallbackCard('fallback-car', '2019 Toyota Supra'),
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
    expect(auctions[0].title).toBe('2019 Toyota Supra');
  });

  it('filters out cards with titles matching /^(past|current|featured)/i', async () => {
    const page1 = makeCaBListingPage([
      makeCaBCard('past-auctions', 'Past Auctions', '$0', 0),
      makeCaBCard('real-car', '2021 Porsche Cayman GT4', '$95,000', 33),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page1),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    // "Past Auctions" should be filtered out
    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('2021 Porsche Cayman GT4');
  });

  it('filters out non-auction URL patterns', async () => {
    // Card with a URL that doesn't match /auctions/[a-z0-9]/ pattern
    const page1 = `<html><body>
      <div class="auction-card">
        <a href="/auctions/?page=2">Next Page</a>
        <h3 class="auction-title">Next Page</h3>
      </div>
      ${makeCaBCard('valid', '2020 Ford Mustang GT', '$45,000', 20)}
    </body></html>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page1),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('2020 Ford Mustang GT');
  });

  it('records error and breaks when page 1 has no cards (including fallback)', async () => {
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
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const promise = scrapeListings(3);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain('Error scraping page 1');
  });

  it('preserves page 1 results when page 2 fetch fails', async () => {
    const page = makeCaBListingPage([
      makeCaBCard('good-car', '2019 Chevrolet Corvette C8', '$70,000', 25),
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
    expect(errors.some(e => e.includes('page 2'))).toBe(true);
  });

  it('parses mileage from stats text on card', async () => {
    const page = makeCaBListingPage([
      makeCaBCard('mileage-test', '2021 Tesla Model 3', '$40,000', 12),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions[0].mileage).toBe(15000);
    expect(auctions[0].mileageUnit).toBe('miles');
  });

  it('generates correct auction shape', async () => {
    const page = makeCaBListingPage([
      makeCaBCard('shape-test', '2018 Audi R8 V10', '$130,000', 50),
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    }));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    const a = auctions[0];
    expect(a.externalId).toMatch(/^cab-shape-test/);
    expect(a.platform).toBe('CARS_AND_BIDS');
    expect(a.year).toBe(2018);
    expect(a.make).toBe('Audi');
    expect(a.model).toBe('R8 V10');
    expect(a.url).toContain('/auctions/shape-test');
    expect(a.imageUrl).toContain('shape-test.jpg');
    expect(a.status).toBe('active');
    expect(a.transmission).toBeNull();
    expect(a.endTime).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// scrapeCarsAndBids (main entry)
// ---------------------------------------------------------------------------
describe('C&B: scrapeCarsAndBids', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses default options (maxPages=2, no details)', async () => {
    const page = makeCaBListingPage([
      makeCaBCard('entry-test', '2020 Porsche 718 Cayman', '$60,000', 18),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCarsAndBids();
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions.length).toBeGreaterThanOrEqual(1);
    expect(fetchMock.mock.calls.length).toBe(2); // default maxPages=2
  });

  it('scrapes details when scrapeDetails=true', async () => {
    const listPage = makeCaBListingPage([
      makeCaBCard('detail-test', '2022 BMW M2', '$55,000', 20),
    ]);
    const detailPage = `<html><body>
      <div class="auction-description">Excellent condition M2</div>
      <ul class="quick-facts">
        <li>Mileage: 8,000 Miles</li>
        <li>Transmission: 6-Speed Manual</li>
      </ul>
      <div class="current-bid">$58,000</div>
    </body></html>`;

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/auctions/detail-test') ? detailPage : listPage;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCarsAndBids({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].description).toContain('Excellent condition');
    expect(auctions[0].mileage).toBe(8000);
    expect(auctions[0].transmission).toBe('6-Speed Manual');
  });

  it('handles detail page error gracefully', async () => {
    const listPage = makeCaBListingPage([
      makeCaBCard('err-detail', '2021 Toyota GR86', '$30,000', 14),
    ]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auctions/err-detail')) {
        return Promise.reject(new Error('Detail fetch failed'));
      }
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(listPage),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCarsAndBids({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('2021 Toyota GR86');
    expect(auctions[0].currentBid).toBe(30000);
  });

  it('respects maxPages option', async () => {
    const page = makeCaBListingPage([
      makeCaBCard('mp', '2020 Honda Civic', '$25,000', 8),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCarsAndBids({ maxPages: 1 });
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips details when listings are empty', async () => {
    const emptyPage = '<html><body></body></html>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(emptyPage),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeCarsAndBids({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

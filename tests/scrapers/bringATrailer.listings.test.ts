import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scrapeListings,
  scrapeDetail,
  scrapeBringATrailer,
} from '@/features/scrapers/auctions/bringATrailer';
import type { BaTAuction } from '@/features/scrapers/auctions/bringATrailer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal listings page with 2 auction cards using primary selectors */
function makeBaTListingPage(cards: string[]): string {
  return `<html><body><div class="auctions-list">${cards.join('\n')}</div></body></html>`;
}

/** A single BaT auction card */
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

/** A listings page using the fallback selector path (a[href*="/listing/"] inside li) */
function makeBaTFallbackPage(cards: string[]): string {
  return `<html><body><ul>${cards.join('\n')}</ul></body></html>`;
}

function makeBaTFallbackCard(slug: string, title: string): string {
  return `
    <li>
      <a href="/listing/${slug}/">${title}</a>
      <div class="auction-bid">$50,000</div>
      <div class="bid-count">10 Bids</div>
    </li>`;
}

/** Helper to make fetch return different HTML per URL */
function mockFetchSequence(pages: Map<string, string>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    const html = pages.get(url) || '<html><body></body></html>';
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve(html),
    });
  }));
}

function mockFetchError(error: Error) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
}

function mockFetchHttp(status: number) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    text: () => Promise.resolve('Error'),
  }));
}

// ---------------------------------------------------------------------------
// scrapeListings
// ---------------------------------------------------------------------------
describe('BaT: scrapeListings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('scrapes 2 auctions from page with primary selectors', async () => {
    const page1 = makeBaTListingPage([
      makeBaTCard('1990-porsche-911', '1990 Porsche 911 Carrera 4', '$45,000', 23),
      makeBaTCard('2020-bmw-m3', '2020 BMW M3 Competition', '$72,000', 35),
    ]);
    mockFetchSequence(new Map([
      ['https://bringatrailer.com/auctions', page1],
    ]));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(2);
    expect(auctions[0].title).toBe('1990 Porsche 911 Carrera 4');
    expect(auctions[0].currentBid).toBe(45000);
    expect(auctions[0].platform).toBe('BRING_A_TRAILER');
    expect(auctions[1].title).toBe('2020 BMW M3 Competition');
    expect(auctions[1].currentBid).toBe(72000);
  });

  it('uses correct pagination URL for page 2+', async () => {
    const page1 = makeBaTListingPage([
      makeBaTCard('car-a', '2000 Porsche Boxster', '$20,000', 5),
    ]);
    const page2 = makeBaTListingPage([
      makeBaTCard('car-b', '2010 BMW Z4', '$30,000', 10),
    ]);

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      let html = '<html><body></body></html>';
      if (url === 'https://bringatrailer.com/auctions') html = page1;
      if (url === 'https://bringatrailer.com/auctions/?page=2') html = page2;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeListings(2);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://bringatrailer.com/auctions',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://bringatrailer.com/auctions/?page=2',
      expect.anything(),
    );
  });

  it('falls back to a[href*="/listing/"] selectors when primary returns empty on page 1', async () => {
    const page1 = makeBaTFallbackPage([
      makeBaTFallbackCard('fallback-car', '2015 Ferrari 458'),
    ]);
    mockFetchSequence(new Map([
      ['https://bringatrailer.com/auctions', page1],
    ]));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(errors).toHaveLength(0);
    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('2015 Ferrari 458');
  });

  it('records error and breaks when page 1 has no cards at all', async () => {
    const emptyPage = '<html><body><div>Nothing here</div></body></html>';
    mockFetchSequence(new Map([
      ['https://bringatrailer.com/auctions', emptyPage],
    ]));

    const promise = scrapeListings(2);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain('No auction cards found');
  });

  it('stops entirely when page 1 fetch fails', async () => {
    mockFetchError(new Error('Connection refused'));

    const promise = scrapeListings(3);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]).toContain('Error scraping page 1');
  });

  it('preserves page 1 results when page 2 fetch fails', async () => {
    const page1 = makeBaTListingPage([
      makeBaTCard('car-ok', '1995 Porsche 993', '$80,000', 15),
    ]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('page=2')) return Promise.reject(new Error('Timeout'));
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(page1),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeListings(2);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('1995 Porsche 993');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some(e => e.includes('page 2'))).toBe(true);
  });

  it('continues parsing other cards when one card throws', async () => {
    // Card with no title -> returns null from parseAuctionCard (not an error),
    // but we test with a card that has an href but empty title
    const page1 = makeBaTListingPage([
      `<article class="auction-item">
        <a href="/listing/no-title/"></a>
        <h3 class="auction-title"></h3>
      </article>`,
      makeBaTCard('good-car', '2020 Porsche 718', '$55,000', 12),
    ]);
    mockFetchSequence(new Map([
      ['https://bringatrailer.com/auctions', page1],
    ]));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    // First card has no title -> parseAuctionCard returns null
    // Second card parses fine
    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('2020 Porsche 718');
  });

  it('maxPages=0 returns empty', async () => {
    const promise = scrapeListings(0);
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('generates correct auction shape', async () => {
    const page1 = makeBaTListingPage([
      makeBaTCard('shape-test', '1985 Ferrari 308 GTS', '$78,000', 42),
    ]);
    mockFetchSequence(new Map([
      ['https://bringatrailer.com/auctions', page1],
    ]));

    const promise = scrapeListings(1);
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    const a = auctions[0];
    expect(a.externalId).toMatch(/^bat-shape-test/);
    expect(a.platform).toBe('BRING_A_TRAILER');
    expect(a.year).toBe(1985);
    expect(a.make).toBe('Ferrari');
    expect(a.model).toBe('308 GTS');
    expect(a.url).toContain('/listing/shape-test/');
    expect(a.imageUrl).toContain('shape-test.jpg');
    expect(a.status).toBe('active');
    expect(a.mileage).toBeNull();
    expect(a.transmission).toBeNull();
    expect(a.endTime).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// scrapeBringATrailer (main entry)
// ---------------------------------------------------------------------------
describe('BaT: scrapeBringATrailer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses default options (maxPages=2, no details)', async () => {
    const page = makeBaTListingPage([
      makeBaTCard('entry-test', '2018 Porsche 911 GT3', '$150,000', 60),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer();
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    expect(auctions.length).toBeGreaterThanOrEqual(1);
    // Default maxPages=2, so fetch called for page 1 and page 2
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('scrapes details when scrapeDetails=true', async () => {
    const listPage = makeBaTListingPage([
      makeBaTCard('detail-test', '1990 Porsche 911', '$45,000', 20),
    ]);
    const detailPage = `<html><body>
      <div class="post-excerpt">Detailed description here</div>
      <ul class="essentials"><li>Miles: 50,000</li><li>Transmission: Manual</li></ul>
      <div class="current-bid">$48,000</div>
    </body></html>`;

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const html = url.includes('/listing/detail-test') ? detailPage : listPage;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(1);
    expect(auctions[0].description).toContain('Detailed description');
    expect(auctions[0].mileage).toBe(50000);
    expect(auctions[0].transmission).toBe('Manual');
    expect(auctions[0].currentBid).toBe(48000);
  });

  it('handles detail page error gracefully (preserves original)', async () => {
    const listPage = makeBaTListingPage([
      makeBaTCard('err-detail', '2000 BMW M5', '$35,000', 15),
    ]);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/listing/err-detail')) {
        return Promise.reject(new Error('Detail fetch failed'));
      }
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(listPage),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions, errors } = await promise;

    // Original listing data preserved despite detail failure
    expect(auctions).toHaveLength(1);
    expect(auctions[0].title).toBe('2000 BMW M5');
    expect(auctions[0].currentBid).toBe(35000);
  });

  it('respects maxPages option', async () => {
    const page = makeBaTListingPage([
      makeBaTCard('max-page', '2020 Audi R8', '$120,000', 30),
    ]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(page),
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer({ maxPages: 1 });
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('respects maxDetails option', async () => {
    const listPage = makeBaTListingPage([
      makeBaTCard('d1', '2020 Porsche Taycan', '$80,000', 20),
      makeBaTCard('d2', '2021 BMW iX', '$60,000', 15),
      makeBaTCard('d3', '2022 Mercedes EQS', '$90,000', 25),
    ]);
    const detailPage = '<html><body><div class="post-excerpt">Detail</div></body></html>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: 'OK',
      text: () => Promise.resolve(listPage),
    });
    // Override for detail pages
    fetchMock.mockImplementation((url: string) => {
      const html = url.includes('/listing/') ? detailPage : listPage;
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        text: () => Promise.resolve(html),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = scrapeBringATrailer({ maxPages: 1, scrapeDetails: true, maxDetails: 2 });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(3);
    // Only first 2 should have been detail-scraped (maxDetails=2)
    // The listing page fetch + 2 detail fetches = 3 total
    const detailCalls = fetchMock.mock.calls.filter(
      (call: any[]) => call[0].includes('/listing/')
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

    const promise = scrapeBringATrailer({ maxPages: 1, scrapeDetails: true });
    await vi.runAllTimersAsync();
    const { auctions } = await promise;

    expect(auctions).toHaveLength(0);
    // Only the listing page fetch, no detail fetches
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { parseAuctionCard as parseBaTCard } from '@/lib/scrapers/bringATrailer';
import { parseAuctionCard as parseCaBCard } from '@/lib/scrapers/carsAndBids';
import { parseAuctionCard as parseCCCard } from '@/lib/scrapers/collectingCars';

// ===========================================================================
// BaT parseAuctionCard edge cases
// ===========================================================================
describe('BaT: parseAuctionCard edge cases', () => {
  it('returns null when card has a link but no title text', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/empty-title/"><img src="img.jpg" /></a>
        <h3 class="auction-title"></h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseBaTCard($, $('div').get(0))).toBeNull();
  });

  it('extracts image from data-src attribute when src is missing', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/lazy-img/">
          <img data-src="https://cdn.bat.com/lazy.jpg" />
        </a>
        <h3 class="auction-title">2000 Honda S2000</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.imageUrl).toBe('https://cdn.bat.com/lazy.jpg');
    expect(result!.images).toContain('https://cdn.bat.com/lazy.jpg');
  });

  it('handles card with no bid information', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/no-bid/">
          <img src="img.jpg" />
        </a>
        <h3 class="auction-title">1965 Ford Mustang</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.currentBid).toBeNull();
    expect(result!.bidCount).toBe(0);
  });

  it('constructs full URL from relative href', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/relative-url/">Test</a>
        <h3 class="auction-title">1990 Porsche 911</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.url).toBe('https://bringatrailer.com/listing/relative-url/');
  });

  it('preserves absolute URL when href is already full', () => {
    const html = `
      <div class="auction-item">
        <a href="https://bringatrailer.com/listing/full-url/">Test</a>
        <h3 class="auction-title">1990 Porsche 911</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result!.url).toBe('https://bringatrailer.com/listing/full-url/');
  });

  it('parses end time from datetime attribute', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/timed/">Test</a>
        <h3 class="auction-title">2020 Toyota GR Supra</h3>
        <time datetime="2025-08-01T12:00:00Z" class="auction-end">Aug 1</time>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result!.endTime).toBeInstanceOf(Date);
    expect((result!.endTime as Date).toISOString()).toBe('2025-08-01T12:00:00.000Z');
  });

  it('handles invalid datetime string', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/bad-time/">Test</a>
        <h3 class="auction-title">2020 Toyota Supra</h3>
        <time class="auction-end">not-a-date</time>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result!.endTime).toBeNull();
  });

  it('sets default status to active', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/active-test/">Test</a>
        <h3 class="auction-title">2020 Mazda MX-5</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result!.status).toBe('active');
  });

  it('falls back to link text when no explicit title element', () => {
    const html = `
      <div class="auction-item">
        <a href="/listing/fallback-title/">1989 Mazda RX-7 Turbo II</a>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseBaTCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.title).toBe('1989 Mazda RX-7 Turbo II');
    expect(result!.year).toBe(1989);
    expect(result!.make).toBe('Mazda');
  });
});

// ===========================================================================
// C&B parseAuctionCard edge cases
// ===========================================================================
describe('C&B: parseAuctionCard edge cases', () => {
  it('returns null for category title starting with "past"', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/past-cars">Past Auctions</a>
        <h3 class="card-title">Past Auctions</h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseCaBCard($, $('div').get(0))).toBeNull();
  });

  it('returns null for category title starting with "current"', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/current-list">Current Auctions</a>
        <h3 class="card-title">Current Auctions</h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseCaBCard($, $('div').get(0))).toBeNull();
  });

  it('returns null for category title starting with "featured"', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/featured-list">Featured Auctions</a>
        <h3 class="card-title">Featured Auctions</h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseCaBCard($, $('div').get(0))).toBeNull();
  });

  it('returns null for non-auction URL pattern', () => {
    const html = `
      <div class="auction-card">
        <a href="/about">About</a>
        <h3 class="card-title">2023 BMW M3</h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseCaBCard($, $('div').get(0))).toBeNull();
  });

  it('extracts mileage from stats text on card', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/2022-porsche-cayman-gt4">
          <img src="img.jpg" />
        </a>
        <h3 class="auction-title">2022 Porsche Cayman GT4</h3>
        <div class="current-bid">$105,000</div>
        <div class="stats">8,500 miles</div>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCaBCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.mileage).toBe(8500);
    expect(result!.mileageUnit).toBe('miles');
  });

  it('detects km mileage unit from stats', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/2022-bmw-m2">
          <img src="img.jpg" />
        </a>
        <h3 class="auction-title">2022 BMW M2 Competition</h3>
        <div class="stats">15,000 km</div>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCaBCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.mileage).toBe(15000);
    expect(result!.mileageUnit).toBe('km');
  });

  it('handles card with no mileage stats', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/2022-tesla-model-s">
          <img src="img.jpg" />
        </a>
        <h3 class="auction-title">2022 Tesla Model S Plaid</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCaBCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.mileage).toBeNull();
  });

  it('sets platform to CARS_AND_BIDS', () => {
    const html = `
      <div class="auction-card">
        <a href="/auctions/2021-ford-gt">
          <img src="img.jpg" />
        </a>
        <h3 class="card-title">2021 Ford GT</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCaBCard($, $('div').get(0));
    expect(result!.platform).toBe('CARS_AND_BIDS');
    expect(result!.externalId).toMatch(/^cab-/);
  });
});

// ===========================================================================
// CC parseAuctionCard edge cases
// ===========================================================================
describe('CC: parseAuctionCard edge cases', () => {
  it('returns null for non-car/lot URL pattern', () => {
    const html = `
      <div class="lot-card">
        <a href="/about">About</a>
        <h3 class="lot-title">About Us</h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseCCCard($, $('div').get(0))).toBeNull();
  });

  it('handles /lots/ URL pattern as well as /cars/', () => {
    const html = `
      <div class="lot-card">
        <a href="/lots/1985-ferrari-testarossa">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title">1985 Ferrari Testarossa</h3>
        <div class="current-bid">£250,000</div>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCCCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.url).toContain('/lots/1985-ferrari-testarossa');
    expect(result!.externalId).toBe('cc-1985-ferrari-testarossa');
  });

  it('extracts location from lot-location class', () => {
    const html = `
      <div class="lot-card">
        <a href="/cars/1990-porsche-964">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title">1990 Porsche 964</h3>
        <span class="lot-location">Munich, Germany</span>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCCCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.location).toBe('Munich, Germany');
  });

  it('handles card with no location', () => {
    const html = `
      <div class="lot-card">
        <a href="/cars/1990-porsche-964">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title">1990 Porsche 964</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCCCard($, $('div').get(0));
    expect(result!.location).toBeNull();
  });

  it('detects km mileage from card text', () => {
    const html = `
      <div class="lot-card">
        <a href="/cars/1992-alpine-a610">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title">1992 Alpine A610 Turbo</h3>
        <div class="stats">65,000 kilometres</div>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCCCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.mileage).toBe(65000);
    expect(result!.mileageUnit).toBe('km');
  });

  it('detects miles mileage from card text', () => {
    const html = `
      <div class="lot-card">
        <a href="/cars/1970-ford-mustang">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title">1970 Ford Mustang Boss 302</h3>
        <div class="stats">32,000 miles</div>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCCCard($, $('div').get(0));
    expect(result).not.toBeNull();
    expect(result!.mileage).toBe(32000);
    expect(result!.mileageUnit).toBe('miles');
  });

  it('sets platform to COLLECTING_CARS', () => {
    const html = `
      <div class="lot-card">
        <a href="/cars/1990-bmw-e30-m3">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title">1990 BMW E30 M3</h3>
      </div>`;
    const $ = cheerio.load(html);
    const result = parseCCCard($, $('div').get(0));
    expect(result!.platform).toBe('COLLECTING_CARS');
    expect(result!.externalId).toMatch(/^cc-/);
  });

  it('returns null for empty title', () => {
    const html = `
      <div class="lot-card">
        <a href="/cars/empty-title">
          <img src="img.jpg" />
        </a>
        <h3 class="lot-title"></h3>
      </div>`;
    const $ = cheerio.load(html);
    expect(parseCCCard($, $('div').get(0))).toBeNull();
  });
});

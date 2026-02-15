import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { parseAuctionCard, scrapeDetail } from '@/lib/scrapers/bringATrailer';
import type { BaTAuction } from '@/lib/scrapers/bringATrailer';

const listingCardHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/bat-listing-card.html'), 'utf-8',
);
const detailPageHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/bat-detail-page.html'), 'utf-8',
);
const detailTableHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/bat-detail-table.html'), 'utf-8',
);

// ---------------------------------------------------------------------------
// parseAuctionCard with HTML fixtures
// ---------------------------------------------------------------------------
describe('BaT: parseAuctionCard with HTML fixture', () => {
  it('extracts auction from well-formed card', () => {
    const $ = cheerio.load(listingCardHtml);
    const el = $('.auction-item').get(0);
    const auction = parseAuctionCard($, el);

    expect(auction).not.toBeNull();
    expect(auction!.platform).toBe('BRING_A_TRAILER');
    expect(auction!.title).toBe('1990 Porsche 911 Carrera 4 Cabriolet');
    expect(auction!.year).toBe(1990);
    expect(auction!.make).toBe('Porsche');
    expect(auction!.model).toBe('911 Carrera 4 Cabriolet');
    expect(auction!.currentBid).toBe(45000);
    expect(auction!.bidCount).toBe(23);
    expect(auction!.url).toContain('/listing/1990-porsche-911-carrera-4-cabriolet/');
    expect(auction!.imageUrl).toBeTruthy();
    expect(auction!.externalId).toMatch(/^bat-/);
    expect(auction!.status).toBe('active');
    expect(auction!.endTime).toBeInstanceOf(Date);
  });

  it('returns null for card with no link', () => {
    const $ = cheerio.load('<div class="auction-item"><p>No link here</p></div>');
    const el = $('div').get(0);
    expect(parseAuctionCard($, el)).toBeNull();
  });

  it('returns null for card with empty title', () => {
    const $ = cheerio.load('<div><a href="/listing/abc/"></a></div>');
    const el = $('div').get(0);
    expect(parseAuctionCard($, el)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scrapeDetail with HTML fixture (mocked fetch)
// ---------------------------------------------------------------------------
describe('BaT: scrapeDetail with HTML fixture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(detailPageHtml),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('enriches auction with detail page data', async () => {
    const baseAuction: BaTAuction = {
      externalId: 'bat-1990-porsche-911-carrera-4-cabriolet',
      platform: 'BRING_A_TRAILER',
      title: '1990 Porsche 911 Carrera 4 Cabriolet',
      make: 'Porsche', model: '911 Carrera 4 Cabriolet', year: 1990,
      mileage: null, mileageUnit: 'miles', transmission: null,
      engine: null, exteriorColor: null, interiorColor: null,
      location: null, currentBid: 45000, bidCount: 23,
      endTime: null, url: 'https://bringatrailer.com/listing/1990-porsche-911-carrera-4-cabriolet/',
      imageUrl: null, description: null, sellerNotes: null,
      status: 'active', vin: null, images: [],
      reserveStatus: null, bodyStyle: null,
    };

    const detailPromise = scrapeDetail(baseAuction);
    await vi.runAllTimersAsync();
    const enriched = await detailPromise;

    expect(enriched.mileage).toBe(45230);
    expect(enriched.mileageUnit).toBe('miles');
    expect(enriched.transmission).toBe('5-Speed Manual');
    expect(enriched.engine).toBe('3.6L Flat-6');
    expect(enriched.exteriorColor).toBe('Guards Red');
    expect(enriched.interiorColor).toBe('Black Leather');
    expect(enriched.location).toBe('San Francisco, CA');
    expect(enriched.vin).toBe('WP0CB2961LS451234');
    expect(enriched.description).toContain('Beautiful example');
    expect(enriched.sellerNotes).toContain('Original owner');
    expect(enriched.images.length).toBe(3);
    expect(enriched.currentBid).toBe(52000);
    expect(enriched.bidCount).toBe(31);
  });

  it('preserves original data when detail page has no matching selectors', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><p>Empty page</p></body></html>'),
    });

    const base: BaTAuction = {
      externalId: 'bat-test', platform: 'BRING_A_TRAILER',
      title: 'Test', make: 'Test', model: 'T', year: 2020,
      mileage: 100, mileageUnit: 'miles', transmission: 'Auto',
      engine: 'V8', exteriorColor: 'Red', interiorColor: 'Black',
      location: 'NYC', currentBid: 50000, bidCount: 10,
      endTime: null, url: 'https://bringatrailer.com/listing/test/',
      imageUrl: 'https://img.test/1.jpg', description: 'Orig desc',
      sellerNotes: 'Orig notes', status: 'active', vin: 'ABC123',
      images: ['https://img.test/1.jpg'],
      reserveStatus: null, bodyStyle: null,
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const result = await detailPromise;

    expect(result.mileage).toBe(100);
    expect(result.transmission).toBe('Auto');
    expect(result.currentBid).toBe(50000);
    expect(result.images).toEqual(['https://img.test/1.jpg']);
  });

  it('extracts essentials from table-format detail page', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(detailTableHtml),
    });

    const base: BaTAuction = {
      externalId: 'bat-1973-rs', platform: 'BRING_A_TRAILER',
      title: '1973 Porsche 911 Carrera RS 2.7', make: 'Porsche',
      model: '911 Carrera RS 2.7', year: 1973,
      mileage: null, mileageUnit: 'miles', transmission: null,
      engine: null, exteriorColor: null, interiorColor: null,
      location: null, currentBid: 1000000, bidCount: 50,
      endTime: null, url: 'https://bringatrailer.com/listing/1973-rs/',
      imageUrl: null, description: null, sellerNotes: null,
      status: 'active', vin: null, images: [],
      reserveStatus: null, bodyStyle: null,
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const enriched = await detailPromise;

    expect(enriched.mileage).toBe(58200);
    expect(enriched.mileageUnit).toBe('miles');
    expect(enriched.transmission).toBe('5-Speed Manual');
    expect(enriched.engine).toBe('2.7L Flat-6');
    expect(enriched.exteriorColor).toBe('Light Yellow');
    expect(enriched.interiorColor).toBe('Black Leatherette');
    expect(enriched.location).toBe('Munich, Germany');
    expect(enriched.vin).toBe('9113601234');
    expect(enriched.description).toContain('Matching numbers');
    expect(enriched.sellerNotes).toContain('Documented ownership');
    expect(enriched.images).toHaveLength(2);
    expect(enriched.currentBid).toBe(1250000);
    expect(enriched.bidCount).toBe(67);
  });

  it('returns original auction on fetchPage error', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Network timeout'));

    const base: BaTAuction = {
      externalId: 'bat-error', platform: 'BRING_A_TRAILER',
      title: 'Test Car', make: 'Test', model: 'Car', year: 2020,
      mileage: 5000, mileageUnit: 'miles', transmission: 'Auto',
      engine: 'V6', exteriorColor: 'Blue', interiorColor: 'Tan',
      location: 'NYC', currentBid: 25000, bidCount: 8,
      endTime: null, url: 'https://bringatrailer.com/listing/error-test/',
      imageUrl: 'img.jpg', description: 'Orig', sellerNotes: 'Notes',
      status: 'active', vin: 'VIN123', images: ['img.jpg'],
      reserveStatus: null, bodyStyle: null,
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const result = await detailPromise;

    // Original data preserved on error
    expect(result.mileage).toBe(5000);
    expect(result.transmission).toBe('Auto');
    expect(result.currentBid).toBe(25000);
    expect(result.vin).toBe('VIN123');
    expect(result.externalId).toBe('bat-error');
  });
});

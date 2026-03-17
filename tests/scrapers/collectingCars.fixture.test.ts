import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { parseAuctionCard, scrapeDetail } from '@/features/scrapers/auctions/collectingCars';
import type { CCarsAuction } from '@/features/scrapers/auctions/collectingCars';

const listingCardHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/cc-listing-card.html'), 'utf-8',
);
const detailPageHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/cc-detail-page.html'), 'utf-8',
);
const detailLabelValueHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/cc-detail-labelvalue.html'), 'utf-8',
);

// ---------------------------------------------------------------------------
// parseAuctionCard with HTML fixtures
// ---------------------------------------------------------------------------
describe('CC: parseAuctionCard with HTML fixture', () => {
  it('extracts auction from well-formed card', () => {
    const $ = cheerio.load(listingCardHtml);
    const el = $('.lot-card').get(0);
    const auction = parseAuctionCard($, el);

    expect(auction).not.toBeNull();
    expect(auction!.platform).toBe('COLLECTING_CARS');
    expect(auction!.title).toBe('1992 Porsche 964 Carrera RS');
    expect(auction!.year).toBe(1992);
    expect(auction!.make).toBe('Porsche');
    expect(auction!.model).toBe('964 Carrera RS');
    expect(auction!.currentBid).toBe(185000);
    expect(auction!.bidCount).toBe(18);
    expect(auction!.url).toContain('/cars/1992-porsche-964-carrera-rs');
    expect(auction!.externalId).toMatch(/^cc-/);
    expect(auction!.location).toBe('London, UK');
    expect(auction!.mileage).toBe(42000);
    expect(auction!.mileageUnit).toBe('km');
    expect(auction!.endTime).toBeInstanceOf(Date);
  });

  it('returns null for card with no link', () => {
    const $ = cheerio.load('<div class="lot-card"><p>No link</p></div>');
    const el = $('div').get(0);
    expect(parseAuctionCard($, el)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scrapeDetail with HTML fixture
// ---------------------------------------------------------------------------
describe('CC: scrapeDetail with HTML fixture', () => {
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
    const baseAuction: CCarsAuction = {
      externalId: 'cc-1992-porsche-964-carrera-rs',
      platform: 'COLLECTING_CARS',
      title: '1992 Porsche 964 Carrera RS',
      make: 'Porsche', model: '964 Carrera RS', year: 1992,
      mileage: null, mileageUnit: 'miles', transmission: null,
      engine: null, exteriorColor: null, interiorColor: null,
      location: null, currentBid: 185000, bidCount: 18,
      endTime: null, url: 'https://collectingcars.com/cars/1992-porsche-964-carrera-rs',
      imageUrl: null, description: null, sellerNotes: null,
      status: 'active', vin: null, images: [],
    };

    const detailPromise = scrapeDetail(baseAuction);
    await vi.runAllTimersAsync();
    const enriched = await detailPromise;

    expect(enriched.mileage).toBe(42000);
    expect(enriched.mileageUnit).toBe('km');
    expect(enriched.transmission).toBe('5-Speed Manual');
    expect(enriched.engine).toBe('3.6L Flat-6');
    expect(enriched.exteriorColor).toBe('Grand Prix White');
    expect(enriched.interiorColor).toBe('Grey Cloth');
    expect(enriched.location).toBe('London, United Kingdom');
    expect(enriched.vin).toBe('WPOZZZ96ZNS490123');
    expect(enriched.description).toContain('Exceptional example');
    expect(enriched.images.length).toBe(4);
    expect(enriched.currentBid).toBe(195000);
    expect(enriched.bidCount).toBe(22);
  });

  it('extracts specs from label/value child-element format with British spelling', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(detailLabelValueHtml),
    });

    const base: CCarsAuction = {
      externalId: 'cc-e30-m3', platform: 'COLLECTING_CARS',
      title: '1990 BMW E30 M3 Sport Evolution', make: 'BMW',
      model: 'E30 M3 Sport Evolution', year: 1990,
      mileage: null, mileageUnit: 'miles', transmission: null,
      engine: null, exteriorColor: null, interiorColor: null,
      location: null, currentBid: 150000, bidCount: 30,
      endTime: null, url: 'https://collectingcars.com/cars/1990-bmw-e30-m3-evo',
      imageUrl: null, description: null, sellerNotes: null,
      status: 'active', vin: null, images: [],
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const enriched = await detailPromise;

    expect(enriched.mileage).toBe(78500);
    expect(enriched.mileageUnit).toBe('km');
    expect(enriched.transmission).toBe('5-Speed Getrag');
    expect(enriched.engine).toBe('2.5L S14 4-Cylinder');
    expect(enriched.exteriorColor).toBe('Brilliant Black');
    expect(enriched.interiorColor).toBe('Silver Cloth');
    expect(enriched.location).toBe('Stuttgart, Germany');
    expect(enriched.vin).toBe('WBSAK0308LAE40234');
    expect(enriched.description).toContain('Final evolution');
    expect(enriched.sellerNotes).toContain('Numbers matching');
    expect(enriched.images).toHaveLength(5);
    expect(enriched.currentBid).toBe(165000);
    expect(enriched.bidCount).toBe(41);
  });

  it('returns original auction on fetchPage error', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('DNS resolution failed'));

    const base: CCarsAuction = {
      externalId: 'cc-error', platform: 'COLLECTING_CARS',
      title: 'Test Car', make: 'Test', model: 'Car', year: 2020,
      mileage: 20000, mileageUnit: 'km', transmission: 'Manual',
      engine: 'I4', exteriorColor: 'Red', interiorColor: 'Black',
      location: 'London', currentBid: 30000, bidCount: 5,
      endTime: null, url: 'https://collectingcars.com/cars/error-test',
      imageUrl: 'img.jpg', description: 'Orig', sellerNotes: 'Notes',
      status: 'active', vin: 'CHASSIS123', images: ['img.jpg'],
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const result = await detailPromise;

    expect(result.mileage).toBe(20000);
    expect(result.mileageUnit).toBe('km');
    expect(result.transmission).toBe('Manual');
    expect(result.currentBid).toBe(30000);
    expect(result.vin).toBe('CHASSIS123');
  });
});

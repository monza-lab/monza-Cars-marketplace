import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { parseAuctionCard, scrapeDetail } from '@/features/scrapers/auctions/carsAndBids';
import type { CaBAuction } from '@/features/scrapers/auctions/carsAndBids';

const listingCardHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/cab-listing-card.html'), 'utf-8',
);
const detailPageHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/cab-detail-page.html'), 'utf-8',
);
const detailDtddHtml = fs.readFileSync(
  path.join(__dirname, '../fixtures/cab-detail-dtdd.html'), 'utf-8',
);

// ---------------------------------------------------------------------------
// parseAuctionCard with HTML fixtures
// ---------------------------------------------------------------------------
describe('C&B: parseAuctionCard with HTML fixture', () => {
  it('extracts auction from well-formed card', () => {
    const $ = cheerio.load(listingCardHtml);
    const el = $('.auction-card').get(0);
    const auction = parseAuctionCard($, el);

    expect(auction).not.toBeNull();
    expect(auction!.platform).toBe('CARS_AND_BIDS');
    expect(auction!.title).toBe('2023 Porsche 911 GT3 RS');
    expect(auction!.year).toBe(2023);
    expect(auction!.make).toBe('Porsche');
    expect(auction!.model).toBe('911 GT3 RS');
    expect(auction!.currentBid).toBe(285000);
    expect(auction!.bidCount).toBe(47);
    expect(auction!.url).toContain('/auctions/2023-porsche-911-gt3-rs');
    expect(auction!.externalId).toMatch(/^cab-/);
    expect(auction!.mileage).toBe(12500);
    expect(auction!.endTime).toBeInstanceOf(Date);
  });

  it('returns null for card with no link', () => {
    const $ = cheerio.load('<div class="auction-card"><p>No link</p></div>');
    const el = $('div').get(0);
    expect(parseAuctionCard($, el)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scrapeDetail with HTML fixture
// ---------------------------------------------------------------------------
describe('C&B: scrapeDetail with HTML fixture', () => {
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
    const baseAuction: CaBAuction = {
      externalId: 'cab-2023-porsche-911-gt3-rs',
      platform: 'CARS_AND_BIDS',
      title: '2023 Porsche 911 GT3 RS',
      make: 'Porsche', model: '911 GT3 RS', year: 2023,
      mileage: null, mileageUnit: 'miles', transmission: null,
      engine: null, exteriorColor: null, interiorColor: null,
      location: null, currentBid: 285000, bidCount: 47,
      endTime: null, url: 'https://carsandbids.com/auctions/2023-porsche-911-gt3-rs',
      imageUrl: null, description: null, sellerNotes: null,
      status: 'active', vin: null, images: [],
    };

    const detailPromise = scrapeDetail(baseAuction);
    await vi.runAllTimersAsync();
    const enriched = await detailPromise;

    expect(enriched.mileage).toBe(12500);
    expect(enriched.transmission).toBe('7-Speed PDK');
    expect(enriched.engine).toBe('4.0L Flat-6');
    expect(enriched.exteriorColor).toBe('White');
    expect(enriched.interiorColor).toBe('Black Alcantara');
    expect(enriched.location).toBe('Los Angeles, CA');
    expect(enriched.vin).toBe('WP0AF2A90PS270123');
    expect(enriched.description).toContain('Stunning GT3 RS');
    expect(enriched.images.length).toBe(2);
    expect(enriched.currentBid).toBe(290000);
    expect(enriched.bidCount).toBe(52);
  });

  it('extracts specs from dt/dd format detail page', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(detailDtddHtml),
    });

    const base: CaBAuction = {
      externalId: 'cab-ford-gt', platform: 'CARS_AND_BIDS',
      title: '2019 Ford GT Carbon Series', make: 'Ford',
      model: 'GT Carbon Series', year: 2019,
      mileage: null, mileageUnit: 'miles', transmission: null,
      engine: null, exteriorColor: null, interiorColor: null,
      location: null, currentBid: 1000000, bidCount: 70,
      endTime: null, url: 'https://carsandbids.com/auctions/2019-ford-gt',
      imageUrl: null, description: null, sellerNotes: null,
      status: 'active', vin: null, images: [],
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const enriched = await detailPromise;

    expect(enriched.mileage).toBe(3200);
    expect(enriched.mileageUnit).toBe('miles');
    expect(enriched.transmission).toBe('7-Speed Dual-Clutch');
    expect(enriched.engine).toBe('3.5L Twin-Turbo V6');
    expect(enriched.exteriorColor).toBe('Liquid Carbon');
    expect(enriched.interiorColor).toBe('Dark Energy');
    expect(enriched.location).toBe('Scottsdale, AZ');
    expect(enriched.vin).toBe('2FAGP8JZ9KA100123');
    expect(enriched.description).toContain('Rare Carbon Series');
    expect(enriched.images).toHaveLength(3);
    expect(enriched.currentBid).toBe(1150000);
    expect(enriched.bidCount).toBe(89);
  });

  it('returns original auction on fetchPage error', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Connection reset'));

    const base: CaBAuction = {
      externalId: 'cab-error', platform: 'CARS_AND_BIDS',
      title: 'Test Car', make: 'Test', model: 'Car', year: 2021,
      mileage: 10000, mileageUnit: 'miles', transmission: 'PDK',
      engine: 'Flat-6', exteriorColor: 'White', interiorColor: 'Black',
      location: 'LA', currentBid: 80000, bidCount: 20,
      endTime: null, url: 'https://carsandbids.com/auctions/error-test',
      imageUrl: 'img.jpg', description: 'Orig', sellerNotes: 'Notes',
      status: 'active', vin: 'VIN456', images: ['img.jpg'],
    };

    const detailPromise = scrapeDetail(base);
    await vi.runAllTimersAsync();
    const result = await detailPromise;

    expect(result.mileage).toBe(10000);
    expect(result.transmission).toBe('PDK');
    expect(result.currentBid).toBe(80000);
    expect(result.vin).toBe('VIN456');
  });
});

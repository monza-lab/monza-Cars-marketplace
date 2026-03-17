import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  parsePrice,
  parseBidCount,
} from '@/features/scrapers/common/scraper';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------
describe('Zero-cost scraper: detectPlatform', () => {
  it('detects bringatrailer.com', () => {
    expect(detectPlatform('https://bringatrailer.com/listing/1990-porsche/'))
      .toBe('bringatrailer');
  });

  it('detects rmsothebys.com', () => {
    expect(detectPlatform('https://rmsothebys.com/en/auctions/lot/123'))
      .toBe('rmsothebys');
  });

  it('detects carsandbids.com', () => {
    expect(detectPlatform('https://carsandbids.com/auctions/test'))
      .toBe('carsandbids');
  });

  it('detects collectingcars.com', () => {
    expect(detectPlatform('https://collectingcars.com/cars/test'))
      .toBe('collectingcars');
  });

  it('returns "unknown" for unrecognized domains', () => {
    expect(detectPlatform('https://example.com/cars'))
      .toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(detectPlatform('https://BRINGATRAILER.COM/listing/test'))
      .toBe('bringatrailer');
  });
});

// ---------------------------------------------------------------------------
// parsePrice
// ---------------------------------------------------------------------------
describe('Zero-cost scraper: parsePrice', () => {
  it('parses "$45,000" to 45000', () => {
    expect(parsePrice('$45,000')).toBe(45000);
  });

  it('parses "£120,000" to 120000', () => {
    expect(parsePrice('£120,000')).toBe(120000);
  });

  it('parses "€85,500" to 85500', () => {
    expect(parsePrice('€85,500')).toBe(85500);
  });

  it('returns null for null', () => {
    expect(parsePrice(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parsePrice(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parsePrice('no price')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseBidCount
// ---------------------------------------------------------------------------
describe('Zero-cost scraper: parseBidCount', () => {
  it('parses "42 bids" to 42', () => {
    expect(parseBidCount('42 bids')).toBe(42);
  });

  it('parses "1 bid" to 1', () => {
    expect(parseBidCount('1 bid')).toBe(1);
  });

  it('parses "123" to 123', () => {
    expect(parseBidCount('123')).toBe(123);
  });

  it('returns null for null', () => {
    expect(parseBidCount(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseBidCount(undefined)).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseBidCount('no bids yet')).toBeNull();
  });
});

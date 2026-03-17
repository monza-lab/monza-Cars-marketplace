import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseMileage,
  parseTitleComponents,
  extractExternalId,
} from '@/features/scrapers/auctions/carsAndBids';

// ---------------------------------------------------------------------------
// parsePrice
// ---------------------------------------------------------------------------
describe('C&B: parsePrice', () => {
  it('parses "$45,000" to 45000', () => {
    expect(parsePrice('$45,000')).toBe(45000);
  });

  it('parses "Bid to $12,500" to 12500', () => {
    expect(parsePrice('Bid to $12,500')).toBe(12500);
  });

  it('parses "$1,234,567" to 1234567', () => {
    expect(parsePrice('$1,234,567')).toBe(1234567);
  });

  it('returns null for undefined', () => {
    expect(parsePrice(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseMileage
// ---------------------------------------------------------------------------
describe('C&B: parseMileage', () => {
  it('parses "45,230 Miles" to 45230', () => {
    expect(parseMileage('45,230 Miles')).toBe(45230);
  });

  it('parses "12000" to 12000', () => {
    expect(parseMileage('12000')).toBe(12000);
  });

  it('returns null for undefined', () => {
    expect(parseMileage(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMileage('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseTitleComponents
// ---------------------------------------------------------------------------
describe('C&B: parseTitleComponents', () => {
  it('parses "2023 Porsche 911 GT3 RS"', () => {
    expect(parseTitleComponents('2023 Porsche 911 GT3 RS')).toEqual({
      year: 2023,
      make: 'Porsche',
      model: '911 GT3 RS',
    });
  });

  it('handles Tesla (C&B-specific make)', () => {
    expect(parseTitleComponents('2022 Tesla Model S Plaid')).toEqual({
      year: 2022,
      make: 'Tesla',
      model: 'Model S Plaid',
    });
  });

  it('handles Rivian (C&B-specific make)', () => {
    expect(parseTitleComponents('2023 Rivian R1T Adventure')).toEqual({
      year: 2023,
      make: 'Rivian',
      model: 'R1T Adventure',
    });
  });

  it('handles multi-word "Alfa Romeo"', () => {
    expect(parseTitleComponents('1973 Alfa Romeo GTV 2000')).toEqual({
      year: 1973,
      make: 'Alfa Romeo',
      model: 'GTV 2000',
    });
  });

  it('handles no year prefix', () => {
    const result = parseTitleComponents('Porsche 911 Turbo');
    expect(result.year).toBe(0);
    expect(result.make).toBe('Porsche');
  });

  it('falls back for unknown make', () => {
    const result = parseTitleComponents('2020 Karma GS-6');
    expect(result.year).toBe(2020);
    expect(result.make).toBe('Karma');
    expect(result.model).toBe('GS-6');
  });
});

// ---------------------------------------------------------------------------
// extractExternalId
// ---------------------------------------------------------------------------
describe('C&B: extractExternalId', () => {
  it('extracts from standard auctions URL', () => {
    expect(extractExternalId('/auctions/2023-porsche-911-gt3-rs'))
      .toBe('cab-2023-porsche-911-gt3-rs');
  });

  it('extracts from full URL', () => {
    expect(extractExternalId('https://carsandbids.com/auctions/2023-porsche-911/'))
      .toBe('cab-2023-porsche-911');
  });

  it('falls back to hash for non-standard URL', () => {
    const id = extractExternalId('https://carsandbids.com/some-other-path');
    expect(id).toMatch(/^cab-\d+$/);
  });

  it('produces deterministic hash', () => {
    const url = 'https://carsandbids.com/random';
    expect(extractExternalId(url)).toBe(extractExternalId(url));
  });
});

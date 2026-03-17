import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseMileage,
  parseTitleComponents,
  extractExternalId,
} from '@/features/scrapers/auctions/collectingCars';

// ---------------------------------------------------------------------------
// parsePrice
// ---------------------------------------------------------------------------
describe('CC: parsePrice', () => {
  it('parses "$45,000" to 45000', () => {
    expect(parsePrice('$45,000')).toBe(45000);
  });

  it('parses "£120,000" (GBP) to 120000', () => {
    expect(parsePrice('£120,000')).toBe(120000);
  });

  it('parses "€85,500" (EUR) to 85500', () => {
    expect(parsePrice('€85,500')).toBe(85500);
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
describe('CC: parseMileage', () => {
  it('parses "45,230 Miles" to 45230', () => {
    expect(parseMileage('45,230 Miles')).toBe(45230);
  });

  it('parses "12,000 km" to 12000', () => {
    expect(parseMileage('12,000 km')).toBe(12000);
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
describe('CC: parseTitleComponents', () => {
  it('parses standard "1992 Porsche 964 Carrera RS"', () => {
    expect(parseTitleComponents('1992 Porsche 964 Carrera RS')).toEqual({
      year: 1992,
      make: 'Porsche',
      model: '964 Carrera RS',
    });
  });

  it('parses year-at-end format "Porsche 911 (993) Turbo - 1996"', () => {
    expect(parseTitleComponents('Porsche 911 (993) Turbo - 1996')).toEqual({
      year: 1996,
      make: 'Porsche',
      model: '911 (993) Turbo',
    });
  });

  it('handles Alpine (CC-specific European make)', () => {
    expect(parseTitleComponents('1973 Alpine A110 1600S')).toEqual({
      year: 1973,
      make: 'Alpine',
      model: 'A110 1600S',
    });
  });

  it('handles Peugeot (CC-specific European make)', () => {
    expect(parseTitleComponents('1989 Peugeot 205 GTI')).toEqual({
      year: 1989,
      make: 'Peugeot',
      model: '205 GTI',
    });
  });

  it('handles Caterham (CC-specific make)', () => {
    expect(parseTitleComponents('2015 Caterham Seven 620R')).toEqual({
      year: 2015,
      make: 'Caterham',
      model: 'Seven 620R',
    });
  });

  it('handles Bugatti', () => {
    expect(parseTitleComponents('2006 Bugatti Veyron 16.4')).toEqual({
      year: 2006,
      make: 'Bugatti',
      model: 'Veyron 16.4',
    });
  });

  it('handles title with no year', () => {
    const result = parseTitleComponents('Ferrari 250 GTO');
    expect(result.year).toBe(0);
    expect(result.make).toBe('Ferrari');
  });

  it('handles empty string', () => {
    const result = parseTitleComponents('');
    expect(result.year).toBe(0);
    expect(result.make).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractExternalId
// ---------------------------------------------------------------------------
describe('CC: extractExternalId', () => {
  it('extracts from /cars/ URL pattern', () => {
    expect(extractExternalId('/cars/1992-porsche-964-carrera-rs'))
      .toBe('cc-1992-porsche-964-carrera-rs');
  });

  it('extracts from /lots/ URL pattern', () => {
    expect(extractExternalId('/lots/1973-alpine-a110'))
      .toBe('cc-1973-alpine-a110');
  });

  it('extracts from full URL', () => {
    expect(extractExternalId('https://collectingcars.com/cars/2015-caterham-seven/'))
      .toBe('cc-2015-caterham-seven');
  });

  it('falls back to hash for non-standard URL', () => {
    const id = extractExternalId('https://collectingcars.com/about');
    expect(id).toMatch(/^cc-\d+$/);
  });

  it('produces deterministic hash', () => {
    const url = 'https://collectingcars.com/random';
    expect(extractExternalId(url)).toBe(extractExternalId(url));
  });
});

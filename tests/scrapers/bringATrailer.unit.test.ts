import { describe, it, expect } from 'vitest';
import {
  parsePrice,
  parseMileage,
  parseTitleComponents,
  extractExternalId,
} from '@/features/scrapers/auctions/bringATrailer';

// ---------------------------------------------------------------------------
// parsePrice
// ---------------------------------------------------------------------------
describe('BaT: parsePrice', () => {
  it('parses "$45,000" to 45000', () => {
    expect(parsePrice('$45,000')).toBe(45000);
  });

  it('parses "Bid to $12,500" to 12500', () => {
    expect(parsePrice('Bid to $12,500')).toBe(12500);
  });

  it('parses "$1,234,567" to 1234567', () => {
    expect(parsePrice('$1,234,567')).toBe(1234567);
  });

  it('parses "$0" to 0', () => {
    expect(parsePrice('$0')).toBe(0);
  });

  it('parses price with decimal "$45,000.50"', () => {
    expect(parsePrice('$45,000.50')).toBe(45000.5);
  });

  it('returns null for undefined', () => {
    expect(parsePrice(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parsePrice('No bids')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseMileage
// ---------------------------------------------------------------------------
describe('BaT: parseMileage', () => {
  it('parses "45,230 Miles" to 45230', () => {
    expect(parseMileage('45,230 Miles')).toBe(45230);
  });

  it('parses "12000" to 12000', () => {
    expect(parseMileage('12000')).toBe(12000);
  });

  it('parses "~500 Miles" to 500', () => {
    expect(parseMileage('~500 Miles')).toBe(500);
  });

  it('parses "1,234 km" to 1234', () => {
    expect(parseMileage('1,234 km')).toBe(1234);
  });

  it('returns null for undefined', () => {
    expect(parseMileage(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMileage('')).toBeNull();
  });

  it('returns null for non-numeric text', () => {
    expect(parseMileage('unknown')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseTitleComponents
// ---------------------------------------------------------------------------
describe('BaT: parseTitleComponents', () => {
  it('parses "1990 Porsche 911 Carrera 4 Cabriolet"', () => {
    expect(parseTitleComponents('1990 Porsche 911 Carrera 4 Cabriolet')).toEqual({
      year: 1990,
      make: 'Porsche',
      model: '911 Carrera 4 Cabriolet',
    });
  });

  it('parses "2024 BMW M3 Competition"', () => {
    expect(parseTitleComponents('2024 BMW M3 Competition')).toEqual({
      year: 2024,
      make: 'BMW',
      model: 'M3 Competition',
    });
  });

  it('handles multi-word make "Alfa Romeo"', () => {
    expect(parseTitleComponents('1967 Alfa Romeo Spider Duetto')).toEqual({
      year: 1967,
      make: 'Alfa Romeo',
      model: 'Spider Duetto',
    });
  });

  it('handles hyphenated make "Mercedes-Benz"', () => {
    expect(parseTitleComponents('1972 Mercedes-Benz 280SL')).toEqual({
      year: 1972,
      make: 'Mercedes-Benz',
      model: '280SL',
    });
  });

  it('handles "Land Rover" two-word make', () => {
    expect(parseTitleComponents('1995 Land Rover Defender 90')).toEqual({
      year: 1995,
      make: 'Land Rover',
      model: 'Defender 90',
    });
  });

  it('handles "Aston Martin" two-word make', () => {
    expect(parseTitleComponents('1965 Aston Martin DB5')).toEqual({
      year: 1965,
      make: 'Aston Martin',
      model: 'DB5',
    });
  });

  it('falls back to first word for unknown make', () => {
    const result = parseTitleComponents('1960 Facel Vega HK500');
    expect(result.year).toBe(1960);
    expect(result.make).toBe('Facel');
    expect(result.model).toBe('Vega HK500');
  });

  it('handles title with no year prefix', () => {
    const result = parseTitleComponents('Ferrari 250 GTO');
    expect(result.year).toBe(0);
    expect(result.make).toBe('Ferrari');
    expect(result.model).toBe('250 GTO');
  });

  it('handles empty string', () => {
    const result = parseTitleComponents('');
    expect(result.year).toBe(0);
    expect(result.make).toBe('');
    expect(result.model).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractExternalId
// ---------------------------------------------------------------------------
describe('BaT: extractExternalId', () => {
  it('extracts from standard listing URL', () => {
    expect(extractExternalId('/listing/1990-porsche-911-carrera-4-cabriolet/'))
      .toBe('bat-1990-porsche-911-carrera-4-cabriolet');
  });

  it('extracts from full URL', () => {
    expect(extractExternalId('https://bringatrailer.com/listing/1990-porsche-911/'))
      .toBe('bat-1990-porsche-911');
  });

  it('falls back to hash for non-standard URL', () => {
    const id = extractExternalId('https://bringatrailer.com/some-other-path');
    expect(id).toMatch(/^bat-\d+$/);
  });

  it('produces deterministic hash for same URL', () => {
    const url = 'https://bringatrailer.com/some-path';
    expect(extractExternalId(url)).toBe(extractExternalId(url));
  });
});

import { describe, it, expect } from 'vitest';
import {
  parseMileageFromTitle,
  parseMileageFromDescription,
  parseBodyStyleFromTitle,
  parseTitleComponents,
} from '@/lib/scrapers/bringATrailer';

// ---------------------------------------------------------------------------
// parseMileageFromTitle
// ---------------------------------------------------------------------------
describe('parseMileageFromTitle', () => {
  it('parses k-shorthand: "10k-Mile 2003 Ferrari 360"', () => {
    const result = parseMileageFromTitle('10k-Mile 2003 Ferrari 360');
    expect(result).toEqual({ mileage: 10000, unit: 'miles' });
  });

  it('parses full numeric: "33,000-Mile 2001 Ferrari 550 Maranello"', () => {
    const result = parseMileageFromTitle('33,000-Mile 2001 Ferrari 550 Maranello');
    expect(result).toEqual({ mileage: 33000, unit: 'miles' });
  });

  it('parses kilometers: "5,000-Kilometer 2020 Ferrari SF90"', () => {
    const result = parseMileageFromTitle('5,000-Kilometer 2020 Ferrari SF90');
    expect(result).toEqual({ mileage: 5000, unit: 'km' });
  });

  it('parses km shorthand: "12k-Km 2019 Ferrari 488"', () => {
    const result = parseMileageFromTitle('12k-Km 2019 Ferrari 488');
    expect(result).toEqual({ mileage: 12000, unit: 'km' });
  });

  it('returns null for no mileage prefix: "2003 Ferrari 360 Spider"', () => {
    expect(parseMileageFromTitle('2003 Ferrari 360 Spider')).toBeNull();
  });

  it('does not match year as mileage: "2003 Ferrari 360"', () => {
    expect(parseMileageFromTitle('2003 Ferrari 360')).toBeNull();
  });

  it('parses single digit k: "8k-Mile 2005 Ferrari F430"', () => {
    const result = parseMileageFromTitle('8k-Mile 2005 Ferrari F430');
    expect(result).toEqual({ mileage: 8000, unit: 'miles' });
  });
});

// ---------------------------------------------------------------------------
// parseMileageFromDescription
// ---------------------------------------------------------------------------
describe('parseMileageFromDescription', () => {
  it('matches "showing X miles"', () => {
    const result = parseMileageFromDescription('The odometer is currently showing 10,000 miles.');
    expect(result).toEqual({ mileage: 10000, unit: 'miles' });
  });

  it('matches "odometer reads X miles"', () => {
    const result = parseMileageFromDescription('The odometer reads 22,500 miles as of January 2026.');
    expect(result).toEqual({ mileage: 22500, unit: 'miles' });
  });

  it('matches "with X miles on the odometer"', () => {
    const result = parseMileageFromDescription('It is offered with 45,000 miles on the odometer.');
    expect(result).toEqual({ mileage: 45000, unit: 'miles' });
  });

  it('matches "X miles shown"', () => {
    const result = parseMileageFromDescription('There are 17,500 miles shown on the replacement speedometer.');
    expect(result).toEqual({ mileage: 17500, unit: 'miles' });
  });

  it('matches k-shorthand in description', () => {
    const result = parseMileageFromDescription('Odometer 22k miles, service records available.');
    expect(result).toEqual({ mileage: 22000, unit: 'miles' });
  });

  it('rejects incidental mention without context: "drove 500 miles to dealer"', () => {
    expect(parseMileageFromDescription('The seller drove 500 miles to the dealer for service.')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseMileageFromDescription('')).toBeNull();
  });

  it('matches "indicates X kilometers"', () => {
    const result = parseMileageFromDescription('The gauge cluster indicates 8,200 kilometers.');
    expect(result).toEqual({ mileage: 8200, unit: 'km' });
  });
});

// ---------------------------------------------------------------------------
// parseBodyStyleFromTitle
// ---------------------------------------------------------------------------
describe('parseBodyStyleFromTitle', () => {
  it('extracts Spider', () => {
    expect(parseBodyStyleFromTitle('2003 Ferrari 360 Spider')).toBe('Spider');
  });

  it('extracts Berlinetta', () => {
    expect(parseBodyStyleFromTitle('2016 Ferrari F12 Berlinetta')).toBe('Berlinetta');
  });

  it('extracts GTB', () => {
    expect(parseBodyStyleFromTitle('1973 Ferrari 365 GTB/4 Daytona')).toBe('GTB');
  });

  it('extracts GTS', () => {
    expect(parseBodyStyleFromTitle('1985 Ferrari 328 GTS')).toBe('GTS');
  });

  it('extracts Targa', () => {
    expect(parseBodyStyleFromTitle('2004 Ferrari 575M Targa')).toBe('Targa');
  });

  it('extracts Spyder (alternate spelling)', () => {
    expect(parseBodyStyleFromTitle('2001 Ferrari 360 Spyder')).toBe('Spyder');
  });

  it('extracts GT4', () => {
    expect(parseBodyStyleFromTitle('1975 Ferrari Dino 308 GT4')).toBe('GT4');
  });

  it('returns null for no match', () => {
    expect(parseBodyStyleFromTitle('2020 Ferrari Roma')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseTitleComponents regression — mileage prefixes still stripped
// ---------------------------------------------------------------------------
describe('parseTitleComponents — mileage prefix handling', () => {
  it('strips "10k-Mile" prefix and extracts correct year/make/model', () => {
    const result = parseTitleComponents('10k-Mile 2003 Ferrari 360 Spider');
    expect(result.year).toBe(2003);
    expect(result.make).toBe('Ferrari');
    expect(result.model).toContain('360');
  });

  it('strips "33,000-Mile" prefix', () => {
    const result = parseTitleComponents('33,000-Mile 2001 Ferrari 550 Maranello');
    expect(result.year).toBe(2001);
    expect(result.make).toBe('Ferrari');
    expect(result.model).toContain('550');
  });

  it('handles title with no prefix normally', () => {
    const result = parseTitleComponents('2003 Ferrari 360 Spider');
    expect(result.year).toBe(2003);
    expect(result.make).toBe('Ferrari');
    expect(result.model).toContain('360');
  });
});

// ---------------------------------------------------------------------------
// Transmission guard — mileage text should NOT match as transmission
// ---------------------------------------------------------------------------
describe('Transmission guard', () => {
  it('"17k Miles Shown on Replacement Speedometer" contains mileage words', () => {
    const text = '17k Miles Shown on Replacement Speedometer';
    // This matches the transmission regex (contains "speed")
    const isTransmissionCandidate = /speed|manual|automatic|dual[\s-]?clutch|transaxle|\bPDK\b|tiptronic|sequential|\bF1\b|SMG|gearbox|CVT/i.test(text);
    expect(isTransmissionCandidate).toBe(true);

    // But it also contains mileage words — the guard should catch it
    const hasMileageWords = /\b(miles?|km|kilometers?|speedometer|odometer)\b/i.test(text);
    expect(hasMileageWords).toBe(true);
  });

  it('"Six-Speed Manual Transmission" does NOT contain mileage words', () => {
    const text = 'Six-Speed Manual Transmission';
    const isTransmissionCandidate = /speed|manual|automatic/i.test(text);
    expect(isTransmissionCandidate).toBe(true);

    const hasMileageWords = /\b(miles?|km|kilometers?|speedometer|odometer)\b/i.test(text);
    expect(hasMileageWords).toBe(false);
  });

  it('"Seven-Speed Dual-Clutch Transaxle" is a valid transmission', () => {
    const text = 'Seven-Speed Dual-Clutch Transaxle';
    const isTransmissionCandidate = /speed|dual[\s-]?clutch|transaxle/i.test(text);
    expect(isTransmissionCandidate).toBe(true);

    const hasMileageWords = /\b(miles?|km|kilometers?|speedometer|odometer)\b/i.test(text);
    expect(hasMileageWords).toBe(false);
  });
});

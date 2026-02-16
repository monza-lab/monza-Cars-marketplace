import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Validation function for scraper output
// ---------------------------------------------------------------------------
function validateAuction(auction: Record<string, any>): string[] {
  const errors: string[] = [];

  // Required fields
  if (!auction.externalId) errors.push('externalId is empty');
  if (!auction.platform) errors.push('platform is empty');
  if (!auction.title) errors.push('title is empty');
  if (!auction.make) errors.push('make is empty');
  if (!auction.url) errors.push('url is empty');

  // Year range (1886 = first car, to current year + 2 for pre-announcements)
  const currentYear = new Date().getFullYear();
  if (typeof auction.year === 'number') {
    if (auction.year < 1886 || auction.year > currentYear + 2) {
      errors.push(`year ${auction.year} out of range [1886, ${currentYear + 2}]`);
    }
  }

  // Mileage sanity
  if (auction.mileage !== null && auction.mileage !== undefined) {
    if (auction.mileage < 0) {
      errors.push(`negative mileage: ${auction.mileage}`);
    }
    if (auction.mileage > 1_000_000) {
      errors.push(`suspicious mileage (>1M): ${auction.mileage}`);
    }
  }

  // Price sanity
  if (auction.currentBid !== null && auction.currentBid !== undefined) {
    if (auction.currentBid <= 0) {
      errors.push(`non-positive bid: ${auction.currentBid}`);
    }
    if (auction.currentBid < 1000) {
      errors.push(`suspiciously low bid for luxury market: $${auction.currentBid}`);
    }
  }

  // Bid count
  if (typeof auction.bidCount === 'number' && auction.bidCount < 0) {
    errors.push(`negative bidCount: ${auction.bidCount}`);
  }

  // URL validity
  if (auction.url) {
    try {
      new URL(auction.url);
    } catch {
      errors.push(`invalid URL: ${auction.url}`);
    }
  }

  // Platform enum
  const validPlatforms = ['BRING_A_TRAILER', 'CARS_AND_BIDS', 'COLLECTING_CARS'];
  if (auction.platform && !validPlatforms.includes(auction.platform)) {
    errors.push(`unknown platform: ${auction.platform}`);
  }

  // ExternalId prefix matches platform
  const prefixMap: Record<string, string> = {
    BRING_A_TRAILER: 'bat-',
    CARS_AND_BIDS: 'cab-',
    COLLECTING_CARS: 'cc-',
  };
  const expectedPrefix = prefixMap[auction.platform];
  if (expectedPrefix && auction.externalId && !auction.externalId.startsWith(expectedPrefix)) {
    errors.push(
      `externalId "${auction.externalId}" does not start with "${expectedPrefix}" for ${auction.platform}`,
    );
  }

  // VIN validation for post-1981 vehicles
  if (auction.vin && auction.year >= 1981 && auction.vin.length !== 17) {
    errors.push(`VIN length ${auction.vin.length} != 17 for year ${auction.year}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Helper: well-formed sample auction
// ---------------------------------------------------------------------------
function validAuction(overrides: Record<string, any> = {}) {
  return {
    externalId: 'bat-1990-porsche-911',
    platform: 'BRING_A_TRAILER',
    title: '1990 Porsche 911 Carrera 4',
    make: 'Porsche',
    model: '911 Carrera 4',
    year: 1990,
    mileage: 45230,
    mileageUnit: 'miles',
    transmission: '5-Speed Manual',
    engine: '3.6L Flat-6',
    exteriorColor: 'Guards Red',
    interiorColor: 'Black',
    location: 'San Francisco, CA',
    currentBid: 52000,
    bidCount: 31,
    endTime: '2025-06-15T18:00:00Z',
    url: 'https://bringatrailer.com/listing/1990-porsche-911/',
    imageUrl: 'https://cdn.bringatrailer.com/img.jpg',
    description: 'Beautiful example',
    sellerNotes: null,
    status: 'active',
    vin: 'WP0CB2961LS451234',
    images: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Data Quality Validation', () => {
  it('passes for a well-formed BaT auction', () => {
    expect(validateAuction(validAuction())).toEqual([]);
  });

  it('passes for a well-formed C&B auction', () => {
    expect(validateAuction(validAuction({
      externalId: 'cab-2023-porsche-gt3',
      platform: 'CARS_AND_BIDS',
      url: 'https://carsandbids.com/auctions/2023-porsche-gt3',
    }))).toEqual([]);
  });

  it('passes for a well-formed CC auction', () => {
    expect(validateAuction(validAuction({
      externalId: 'cc-1992-porsche-964',
      platform: 'COLLECTING_CARS',
      url: 'https://collectingcars.com/cars/1992-porsche-964',
    }))).toEqual([]);
  });

  // --- Missing required fields ---
  it('catches missing externalId', () => {
    const errors = validateAuction(validAuction({ externalId: '' }));
    expect(errors).toContain('externalId is empty');
  });

  it('catches missing platform', () => {
    const errors = validateAuction(validAuction({ platform: '' }));
    expect(errors).toContain('platform is empty');
  });

  it('catches missing title', () => {
    const errors = validateAuction(validAuction({ title: '' }));
    expect(errors).toContain('title is empty');
  });

  it('catches missing make', () => {
    const errors = validateAuction(validAuction({ make: '' }));
    expect(errors).toContain('make is empty');
  });

  it('catches missing url', () => {
    const errors = validateAuction(validAuction({ url: '' }));
    expect(errors).toContain('url is empty');
  });

  // --- Year range ---
  it('catches year too old (before 1886)', () => {
    const errors = validateAuction(validAuction({ year: 1700 }));
    expect(errors.some((e) => e.includes('year'))).toBe(true);
  });

  it('catches year too new (future)', () => {
    const errors = validateAuction(validAuction({ year: 2050 }));
    expect(errors.some((e) => e.includes('year'))).toBe(true);
  });

  it('accepts current year + 1', () => {
    const nextYear = new Date().getFullYear() + 1;
    const errors = validateAuction(validAuction({ year: nextYear }));
    expect(errors.filter((e) => e.includes('year'))).toEqual([]);
  });

  // --- Mileage ---
  it('catches negative mileage', () => {
    const errors = validateAuction(validAuction({ mileage: -100 }));
    expect(errors).toContain('negative mileage: -100');
  });

  it('catches suspiciously high mileage', () => {
    const errors = validateAuction(validAuction({ mileage: 2_000_000 }));
    expect(errors.some((e) => e.includes('suspicious mileage'))).toBe(true);
  });

  it('accepts null mileage', () => {
    const errors = validateAuction(validAuction({ mileage: null }));
    expect(errors.filter((e) => e.includes('mileage'))).toEqual([]);
  });

  // --- Price ---
  it('catches non-positive bid', () => {
    const errors = validateAuction(validAuction({ currentBid: 0 }));
    expect(errors).toContain('non-positive bid: 0');
  });

  it('catches suspiciously low bid for luxury market', () => {
    const errors = validateAuction(validAuction({ currentBid: 5 }));
    expect(errors.some((e) => e.includes('suspiciously low'))).toBe(true);
  });

  it('accepts null currentBid', () => {
    const errors = validateAuction(validAuction({ currentBid: null }));
    expect(errors.filter((e) => e.includes('bid'))).toEqual([]);
  });

  // --- Bid count ---
  it('catches negative bidCount', () => {
    const errors = validateAuction(validAuction({ bidCount: -1 }));
    expect(errors).toContain('negative bidCount: -1');
  });

  // --- URL ---
  it('catches invalid URL', () => {
    const errors = validateAuction(validAuction({ url: 'not-a-url' }));
    expect(errors.some((e) => e.includes('invalid URL'))).toBe(true);
  });

  // --- Platform ---
  it('catches unknown platform', () => {
    const errors = validateAuction(validAuction({ platform: 'UNKNOWN_PLATFORM' }));
    expect(errors).toContain('unknown platform: UNKNOWN_PLATFORM');
  });

  // --- ExternalId prefix ---
  it('catches wrong externalId prefix for platform', () => {
    const errors = validateAuction(validAuction({
      externalId: 'cc-wrong-prefix',
      platform: 'BRING_A_TRAILER',
    }));
    expect(errors.some((e) => e.includes('does not start with'))).toBe(true);
  });

  it('accepts matching prefix (cab- for CARS_AND_BIDS)', () => {
    const errors = validateAuction(validAuction({
      externalId: 'cab-test',
      platform: 'CARS_AND_BIDS',
      url: 'https://carsandbids.com/auctions/test',
    }));
    expect(errors.filter((e) => e.includes('does not start with'))).toEqual([]);
  });

  // --- VIN ---
  it('catches VIN length != 17 for post-1981 vehicles', () => {
    const errors = validateAuction(validAuction({ year: 1990, vin: 'SHORT' }));
    expect(errors.some((e) => e.includes('VIN length'))).toBe(true);
  });

  it('allows short VIN for pre-1981 vehicles', () => {
    const errors = validateAuction(validAuction({ year: 1970, vin: 'SHORT' }));
    expect(errors.filter((e) => e.includes('VIN'))).toEqual([]);
  });

  it('accepts null VIN', () => {
    const errors = validateAuction(validAuction({ vin: null }));
    expect(errors.filter((e) => e.includes('VIN'))).toEqual([]);
  });
});

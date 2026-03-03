import { describe, it, expect } from 'vitest';

type AuctionStatus = 'ACTIVE' | 'ENDING_SOON' | 'ENDED' | 'SOLD' | 'NO_SALE';
type AuctionPlatform = 'BRING_A_TRAILER' | 'CARS_AND_BIDS' | 'COLLECTING_CARS';

interface AuctionCreate {
  externalId: string;
  platform: AuctionPlatform;
  url: string;
  title: string;
  make: string;
  model: string;
  year: number;
  mileageUnit: string;
  bidCount: number;
  status: AuctionStatus;
  images: string[];
  trim?: string | null;
  vin?: string | null;
  mileage?: number | null;
  transmission?: string | null;
  engine?: string | null;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  location?: string | null;
  currentBid?: number | null;
  endTime?: Date | null;
  description?: string | null;
  sellerNotes?: string | null;
}

function mapStatus(raw: string | undefined): AuctionStatus {
  if (!raw) return 'ACTIVE';
  const upper = raw.toUpperCase();
  if (upper === 'ENDED' || upper === 'SOLD') return 'ENDED';
  return 'ACTIVE';
}

function mapScraperToAuction(auction: Record<string, any>): AuctionCreate {
  const images = auction.images?.length
    ? auction.images
    : auction.imageUrl ? [auction.imageUrl] : [];

  return {
    externalId: auction.externalId,
    platform: auction.platform,
    url: auction.url,
    title: auction.title,
    make: auction.make,
    model: auction.model,
    year: auction.year,
    vin: auction.vin ?? null,
    mileage: auction.mileage ?? null,
    mileageUnit: auction.mileageUnit ?? 'miles',
    transmission: auction.transmission ?? null,
    engine: auction.engine ?? null,
    exteriorColor: auction.exteriorColor ?? null,
    interiorColor: auction.interiorColor ?? null,
    location: auction.location ?? null,
    currentBid: auction.currentBid ?? null,
    bidCount: auction.bidCount ?? 0,
    endTime: auction.endTime ? new Date(auction.endTime) : null,
    status: mapStatus(auction.status),
    description: auction.description ?? null,
    sellerNotes: auction.sellerNotes ?? null,
    images,
  };
}

function createSampleAuction(platform: AuctionPlatform) {
  return {
    externalId: `test-${platform.toLowerCase()}-1`,
    platform,
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
    url: 'https://example.com/listing/test',
    imageUrl: 'https://example.com/img.jpg',
    description: 'Test description',
    sellerNotes: 'Test notes',
    status: 'active',
    vin: 'WP0CB2961LS451234',
    images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  };
}

const PLATFORMS: AuctionPlatform[] = ['BRING_A_TRAILER', 'CARS_AND_BIDS', 'COLLECTING_CARS'];

describe('Auction Schema Alignment', () => {
  for (const platform of PLATFORMS) {
    describe(`${platform} -> auction record`, () => {
      it('maps all required fields without error', () => {
        const auction = createSampleAuction(platform);
        const mapped = mapScraperToAuction(auction);

        expect(mapped.externalId).toBeTruthy();
        expect(mapped.platform).toBe(platform);
        expect(mapped.url).toBeTruthy();
        expect(mapped.title).toBeTruthy();
        expect(mapped.make).toBeTruthy();
        expect(mapped.model).toBeTruthy();
        expect(typeof mapped.year).toBe('number');
        expect(typeof mapped.bidCount).toBe('number');
        expect(['ACTIVE', 'ENDING_SOON', 'ENDED', 'SOLD', 'NO_SALE']).toContain(mapped.status);
        expect(Array.isArray(mapped.images)).toBe(true);
        expect(mapped.mileageUnit).toBeTruthy();
      });

      it('maps mileage as integer', () => {
        const mapped = mapScraperToAuction(createSampleAuction(platform));
        if (mapped.mileage !== null && mapped.mileage !== undefined) {
          expect(Number.isInteger(mapped.mileage)).toBe(true);
        }
      });

      it('maps currentBid as number', () => {
        const mapped = mapScraperToAuction(createSampleAuction(platform));
        if (mapped.currentBid !== null && mapped.currentBid !== undefined) {
          expect(typeof mapped.currentBid).toBe('number');
        }
      });

      it('converts endTime string to Date', () => {
        const mapped = mapScraperToAuction(createSampleAuction(platform));
        if (mapped.endTime) {
          expect(mapped.endTime).toBeInstanceOf(Date);
          expect(mapped.endTime.getTime()).not.toBeNaN();
        }
      });

      it('handles null endTime', () => {
        const auction = { ...createSampleAuction(platform), endTime: null };
        const mapped = mapScraperToAuction(auction);
        expect(mapped.endTime).toBeNull();
      });

      it('falls back to imageUrl when images array is empty', () => {
        const auction = { ...createSampleAuction(platform), images: [] };
        const mapped = mapScraperToAuction(auction);
        expect(mapped.images).toEqual(['https://example.com/img.jpg']);
      });

      it('returns empty images when both images and imageUrl are absent', () => {
        const auction = { ...createSampleAuction(platform), images: [], imageUrl: null };
        const mapped = mapScraperToAuction(auction);
        expect(mapped.images).toEqual([]);
      });
    });
  }

  describe('mapStatus', () => {
    it('maps "active" to ACTIVE', () => expect(mapStatus('active')).toBe('ACTIVE'));
    it('maps "ended" to ENDED', () => expect(mapStatus('ended')).toBe('ENDED'));
    it('maps "sold" to ENDED', () => expect(mapStatus('sold')).toBe('ENDED'));
    it('maps "ACTIVE" to ACTIVE', () => expect(mapStatus('ACTIVE')).toBe('ACTIVE'));
    it('maps undefined to ACTIVE', () => expect(mapStatus(undefined)).toBe('ACTIVE'));
    it('maps empty string to ACTIVE', () => expect(mapStatus('')).toBe('ACTIVE'));
    it('maps unknown string to ACTIVE', () => expect(mapStatus('unknown')).toBe('ACTIVE'));
  });
});

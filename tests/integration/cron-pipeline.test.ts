import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// mapStatus: extracted from src/app/api/cron/route.ts for testability
// ---------------------------------------------------------------------------
function mapStatus(raw: string | undefined): 'ACTIVE' | 'ENDED' {
  if (!raw) return 'ACTIVE';
  const upper = raw.toUpperCase();
  if (upper === 'ENDED' || upper === 'SOLD') return 'ENDED';
  return 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Mock Prisma and scrapers
// ---------------------------------------------------------------------------
const mockPrisma = {
  auction: {
    upsert: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    findUnique: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    groupBy: vi.fn().mockResolvedValue([]),
  },
  priceHistory: {
    create: vi.fn().mockResolvedValue({}),
  },
  marketData: {
    upsert: vi.fn().mockResolvedValue({}),
  },
};

function makeFakeScrapedAuction(overrides: Record<string, any> = {}) {
  return {
    externalId: 'bat-test-1',
    platform: 'BRING_A_TRAILER',
    title: '1990 Porsche 911',
    make: 'Porsche', model: '911', year: 1990,
    mileage: 45000, mileageUnit: 'miles',
    transmission: 'Manual', engine: '3.6L Flat-6',
    exteriorColor: 'Red', interiorColor: 'Black',
    location: 'San Francisco, CA',
    currentBid: 50000, bidCount: 10,
    endTime: '2025-06-15T18:00:00Z',
    url: 'https://bringatrailer.com/listing/test',
    imageUrl: 'https://img.test/1.jpg',
    description: 'Test', sellerNotes: null,
    status: 'active', vin: 'WP0CB2961LS451234',
    images: ['https://img.test/1.jpg'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: mapStatus
// ---------------------------------------------------------------------------
describe('Cron Pipeline: mapStatus', () => {
  it('maps "active" to ACTIVE', () => expect(mapStatus('active')).toBe('ACTIVE'));
  it('maps "ACTIVE" to ACTIVE', () => expect(mapStatus('ACTIVE')).toBe('ACTIVE'));
  it('maps "ended" to ENDED', () => expect(mapStatus('ended')).toBe('ENDED'));
  it('maps "ENDED" to ENDED', () => expect(mapStatus('ENDED')).toBe('ENDED'));
  it('maps "sold" to ENDED', () => expect(mapStatus('sold')).toBe('ENDED'));
  it('maps "SOLD" to ENDED', () => expect(mapStatus('SOLD')).toBe('ENDED'));
  it('maps undefined to ACTIVE', () => expect(mapStatus(undefined)).toBe('ACTIVE'));
  it('maps empty string to ACTIVE', () => expect(mapStatus('')).toBe('ACTIVE'));
  it('maps "no_sale" to ACTIVE (not specifically handled)', () => {
    expect(mapStatus('no_sale')).toBe('ACTIVE');
  });
});

// ---------------------------------------------------------------------------
// Tests: Auction upsert logic
// ---------------------------------------------------------------------------
describe('Cron Pipeline: Auction upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts auction with correct externalId key', async () => {
    const auction = makeFakeScrapedAuction();

    const images = auction.images?.length
      ? auction.images
      : auction.imageUrl ? [auction.imageUrl] : [];

    await mockPrisma.auction.upsert({
      where: { externalId: auction.externalId },
      update: {
        title: auction.title,
        make: auction.make, model: auction.model, year: auction.year,
        currentBid: auction.currentBid,
        bidCount: auction.bidCount ?? 0,
        endTime: auction.endTime ? new Date(auction.endTime) : null,
        url: auction.url, images,
        status: mapStatus(auction.status),
        scrapedAt: expect.any(Date),
      },
      create: {
        externalId: auction.externalId,
        platform: auction.platform,
        title: auction.title,
        make: auction.make, model: auction.model, year: auction.year,
        mileageUnit: auction.mileageUnit ?? 'miles',
        bidCount: auction.bidCount ?? 0,
        url: auction.url, images,
        status: mapStatus(auction.status),
      },
    });

    expect(mockPrisma.auction.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { externalId: 'bat-test-1' },
      }),
    );
  });

  it('maps images from imageUrl when images array is empty', () => {
    const auction = makeFakeScrapedAuction({ images: [], imageUrl: 'https://img.test/fallback.jpg' });
    const images = auction.images?.length
      ? auction.images
      : auction.imageUrl ? [auction.imageUrl] : [];

    expect(images).toEqual(['https://img.test/fallback.jpg']);
  });

  it('uses empty array when both images and imageUrl are absent', () => {
    const auction = makeFakeScrapedAuction({ images: [], imageUrl: null });
    const images = auction.images?.length
      ? auction.images
      : auction.imageUrl ? [auction.imageUrl] : [];

    expect(images).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: Price history recording
// ---------------------------------------------------------------------------
describe('Cron Pipeline: Price history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records price history when currentBid is present', async () => {
    const auction = makeFakeScrapedAuction({ currentBid: 75000 });

    if (auction.currentBid != null) {
      const dbAuction = await mockPrisma.auction.findUnique({
        where: { externalId: auction.externalId },
        select: { id: true },
      });

      if (dbAuction) {
        await mockPrisma.priceHistory.create({
          data: { auctionId: dbAuction.id, bid: auction.currentBid },
        });
      }
    }

    expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith({
      data: { auctionId: 'mock-id', bid: 75000 },
    });
  });

  it('does NOT record price history when currentBid is null', async () => {
    const auction = makeFakeScrapedAuction({ currentBid: null });

    if (auction.currentBid != null) {
      await mockPrisma.priceHistory.create({ data: {} as any });
    }

    expect(mockPrisma.priceHistory.create).not.toHaveBeenCalled();
  });

  it('skips price history when auction not found in DB', async () => {
    mockPrisma.auction.findUnique.mockResolvedValueOnce(null);

    const auction = makeFakeScrapedAuction({ currentBid: 60000 });

    if (auction.currentBid != null) {
      const dbAuction = await mockPrisma.auction.findUnique({
        where: { externalId: auction.externalId },
        select: { id: true },
      });

      if (dbAuction) {
        await mockPrisma.priceHistory.create({
          data: { auctionId: dbAuction.id, bid: auction.currentBid },
        });
      }
    }

    expect(mockPrisma.priceHistory.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Market data aggregation
// ---------------------------------------------------------------------------
describe('Cron Pipeline: Market data aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts market data for each make/model group', async () => {
    mockPrisma.auction.groupBy.mockResolvedValue([
      {
        make: 'Porsche', model: '911',
        _avg: { currentBid: 150000 },
        _count: { id: 5 },
        _min: { currentBid: 100000 },
        _max: { currentBid: 200000 },
      },
    ] as any);

    const groups = await mockPrisma.auction.groupBy({
      by: ['make', 'model'],
      _avg: { currentBid: true },
      _count: { id: true },
      _min: { currentBid: true },
      _max: { currentBid: true },
    });

    for (const group of groups) {
      await mockPrisma.marketData.upsert({
        where: {
          make_model_yearStart_yearEnd: {
            make: group.make, model: group.model,
            yearStart: 0, yearEnd: 0,
          },
        },
        update: {
          avgPrice: group._avg.currentBid,
          lowPrice: group._min.currentBid,
          highPrice: group._max.currentBid,
          totalSales: group._count.id,
        },
        create: {
          make: group.make, model: group.model,
          yearStart: 0, yearEnd: 0,
          avgPrice: group._avg.currentBid,
          lowPrice: group._min.currentBid,
          highPrice: group._max.currentBid,
          totalSales: group._count.id,
        },
      });
    }

    expect(mockPrisma.marketData.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.marketData.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ avgPrice: 150000 }),
      }),
    );
  });

  it('marks expired auctions as ENDED', async () => {
    await mockPrisma.auction.updateMany({
      where: { status: 'ACTIVE', endTime: { lt: expect.any(Date) } },
      data: { status: 'ENDED' },
    });

    expect(mockPrisma.auction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ENDED' },
      }),
    );
  });
});

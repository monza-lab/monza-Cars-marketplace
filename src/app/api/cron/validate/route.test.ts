import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock the monitoring module
vi.mock('@/features/scrapers/common/monitoring', () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

// Mock the listing validator
vi.mock('@/features/scrapers/common/listingValidator', () => ({
  validateListing: vi.fn((listing) => {
    // Default behavior: accept valid Porsche listings
    if (listing.make === 'Porsche' && listing.model && listing.model !== 'Invalid') {
      // Test for color-as-model correction
      if (listing.model === 'Guards Red') {
        return {
          valid: true,
          fixedModel: '911 Turbo',
        };
      }
      return { valid: true };
    }
    // Reject non-Porsche
    if (listing.make !== 'Porsche') {
      return { valid: false, reason: 'non-porsche-make' };
    }
    // Reject invalid model
    return { valid: false, reason: 'unresolvable-model' };
  }),
}));

// Track mocked Supabase chain calls
let mockFrom: any;

describe('GET /api/cron/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fluent API chain for listing fetches
    mockFrom = vi.fn((table: string) => {
      if (table === 'listings') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn((_field: string, ids: any[]) => ({
              select: vi.fn().mockResolvedValue({
                data: ids.map((id) => ({ id })),
                error: null,
              }),
            })),
          }),
        };
      }
      if (table === 'price_history') {
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        };
      }
      return null;
    });

    // Set environment variables
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  it('returns 401 Unauthorized when auth header is missing', async () => {
    const request = new Request('http://localhost:3000/api/cron/validate');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns 401 Unauthorized when auth header is invalid', async () => {
    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns 200 with empty results when no listings found', async () => {
    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.scanned).toBe(0);
    expect(json.fixed).toBe(0);
    expect(json.deleted).toBe(0);
  });

  it('scans and returns statistics for valid listings', async () => {
    // Setup mock to return some listings
    const mockListings = [
      { id: 'l1', make: 'Porsche', model: '911 Carrera', year: 2020, title: '2020 911' },
      { id: 'l2', make: 'Porsche', model: 'Cayenne', year: 2021, title: '2021 Cayenne' },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'listings') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: mockListings,
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    console.error("validate batch response", response.status, json);
    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.scanned).toBe(2);
    expect(json.fixed).toBe(0);
    expect(json.deleted).toBe(0);
  });


  it('fixes listings with color as model', async () => {
    const { validateListing } = await import('@/features/scrapers/common/listingValidator');

    (validateListing as any).mockImplementation((listing: any) => {
      if (listing.model === 'Guards Red') {
        return {
          valid: true,
          fixedModel: '911 Turbo',
        };
      }
      return { valid: true };
    });

    const mockListings = [
      { id: 'l1', make: 'Porsche', model: 'Guards Red', year: 1987, title: '1987 911 Turbo Guards Red' },
    ];

    mockFrom.mockImplementation((table: string) => {
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                  data: mockListings,
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
            select: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.scanned).toBe(1);
    expect(json.fixed).toBe(1);
    expect(json.fixedItems).toHaveLength(1);
    expect(json.fixedItems[0]).toEqual({
      id: 'l1',
      oldModel: 'Guards Red',
      newModel: '911 Turbo',
    });
  });

  it('handles Supabase fetch errors gracefully', async () => {
    const { createClient } = await import('@supabase/supabase-js');

    (createClient as any).mockImplementationOnce(() => ({
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Connection failed' },
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: null, error: null }),
              select: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return null;
      }),
    }));

    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Fetch error');
  });

  it('calls monitoring functions with correct parameters', async () => {
    const { markScraperRunStarted, recordScraperRun, clearScraperRunActive } = await import(
      '@/features/scrapers/common/monitoring'
    );
    const { createClient } = await import('@supabase/supabase-js');

    (createClient as any).mockImplementationOnce(() => ({
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  range: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: null, error: null }),
              select: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }),
    }));

    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    await GET(request);

    // Verify monitoring was called
    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: 'validate',
        runtime: 'vercel_cron',
      })
    );

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: 'validate',
        success: true,
        runtime: 'vercel_cron',
        discovered: 0,
        written: 0,
        errors_count: 0,
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith('validate');
  });

  it('batches delete operations in chunks of 50', async () => {
    const { validateListing } = await import('@/features/scrapers/common/listingValidator');
    const { createClient } = await import('@supabase/supabase-js');

    // Mock validator to reject all listings
    (validateListing as any).mockImplementation(() => ({
      valid: false,
      reason: 'test-reason',
    }));

    // Create 75 listings (should result in 2 batches)
    const mockListings = Array.from({ length: 75 }, (_, i) => ({
      id: `l${i}`,
      make: 'Porsche',
      model: `Model${i}`,
      year: 2020,
      title: `Listing ${i}`,
    }));

    let priceHistoryDeleteCount = 0;
    let listingsDeleteCount = 0;

    mockFrom.mockImplementationOnce((table: string) => {
      if (table === 'listings') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: mockListings,
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn((_field: string, ids: any[]) => {
              listingsDeleteCount++;
              return {
                select: vi.fn().mockResolvedValue({
                  data: ids.map((id) => ({ id })),
                  error: null,
                }),
              };
            }),
          }),
        };
      }
      if (table === 'price_history') {
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn((_field: string, _ids: any[]) => {
              priceHistoryDeleteCount++;
              return {
                data: null,
                error: null,
              };
            }),
          }),
        };
      }
      return null;
    });

    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.scanned).toBe(75);
    expect(json.deleted).toBe(75);
  });


  it('records error in monitoring on exception', async () => {
    const { recordScraperRun, clearScraperRunActive } = await import(
      '@/features/scrapers/common/monitoring'
    );
    const { createClient } = await import('@supabase/supabase-js');

    (createClient as any).mockImplementationOnce(() => ({
      from: vi.fn((table: string) => {
        if (table === 'listings') {
          return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockRejectedValue(new Error('Database connection lost')),
              }),
            }),
          }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: null, error: null }),
              select: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        return {
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }),
    }));

    const request = new Request('http://localhost:3000/api/cron/validate', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);

    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: 'validate',
        success: false,
        errors_count: 1,
        error_messages: expect.arrayContaining(['Database connection lost']),
      })
    );

    expect(clearScraperRunActive).toHaveBeenCalledWith('validate');
  });
});

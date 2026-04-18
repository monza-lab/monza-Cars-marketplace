import { NextRequest, NextResponse } from "next/server";
import {
  type CollectorCar,
  type InvestmentGrade
} from "@/lib/curatedCars";
import {
  fetchLiveListingAggregateCounts,
  fetchLiveListingsAsCollectorCars,
  fetchPaginatedListings,
  fetchSeriesCounts,
} from "@/lib/supabaseLiveListings";
import { normalizeSupportedMake, resolveRequestedMake } from "@/lib/makeProfiles";
import { getModelPatternsForSeries } from "@/lib/brandConfig";

// Per-source budget for the non-paginated (dashboard) path.
// Dashboard only needs enough data for family-level aggregations (counts, sample images).
// Individual car browsing uses the paginated path instead.
const PER_SOURCE_BUDGET = 200;

// Maximum page size for paginated requests
const MAX_PAGE_SIZE = 200;

function transformCar(car: CollectorCar) {
  return {
    id: car.id,
    title: car.title,
    year: car.year,
    make: car.make,
    model: car.model,
    trim: car.trim,
    engine: car.engine,
    transmission: car.transmission,
    mileage: car.mileage,
    mileageUnit: car.mileageUnit,
    location: car.location,
    platform: car.platform,
    status: car.status,
    price: car.price,
    currentBid: car.currentBid,
    bidCount: car.bidCount,
    endTime: car.endTime instanceof Date ? car.endTime.toISOString() : car.endTime,
    image: car.images?.[0] || car.image || "/cars/placeholder.svg",
    images: car.images.slice(0, 1),
    sourceUrl: car.sourceUrl ?? null,
    investmentGrade: car.investmentGrade,
    trend: car.trend,
    trendValue: car.trendValue,
    category: car.category,
    region: car.region,
    originalCurrency: car.originalCurrency ?? null,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("query") || "";
  const filter = searchParams.get("filter") || "";
  const make = searchParams.get("make") || "";
  const grade = searchParams.get("grade") || "";
  const status = searchParams.get("status") || "";
  const platform = searchParams.get("platform") || "";
  const category = searchParams.get("category") || "";
  const family = searchParams.get("family") || "";
  const sortBy = searchParams.get("sortBy") || "endTime";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  const requestedMake = make && make !== "All Makes"
    ? normalizeSupportedMake(make)
    : resolveRequestedMake(null);

  if (make && make !== "All Makes" && !requestedMake) {
    return NextResponse.json({
      auctions: [],
      total: 0,
      page: 1,
      limit: 0,
      totalPages: 0,
    });
  }

  // ─── Paginated path (server-side filtering & pagination) ───
  const isPaginated = searchParams.has("pageSize") || searchParams.has("cursor");

  if (isPaginated) {
    const rawPageSize = Math.min(
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50),
      MAX_PAGE_SIZE
    );
    const cursor = searchParams.get("cursor") || null;
    const offset = cursor
      ? (JSON.parse(atob(cursor)) as { offset: number }).offset
      : 0;

    // Map platform query param to source value for DB filtering
    const platformFilter = platform && platform !== "All Platforms" ? platform : null;

    // Map region from filter params
    const regionParam = searchParams.get("region") || null;

    // Determine DB-level status filter
    const dbStatus: "active" | "all" =
      status === "Ended" || status === "ENDED" ? "all" : "active";

    // Resolve family to DB-level model patterns
    const modelPatterns = family
      ? getModelPatternsForSeries(family, requestedMake ?? "Porsche")
      : null;

    const paginatedPromise = fetchPaginatedListings({
      make: requestedMake ?? "Porsche",
      pageSize: rawPageSize,
      offset,
      region: regionParam,
      platform: platformFilter,
      query: query || null,
      sortBy,
      sortOrder: sortOrder as "asc" | "desc",
      status: dbStatus,
      series: family || null,
      modelPatterns,
    });

    // Only fetch aggregates on the first page (offset === 0)
    const aggregatesPromise =
      offset === 0
        ? fetchLiveListingAggregateCounts({ make: requestedMake })
        : null;

    const [paginatedResult, aggregatesResult] = await Promise.all([
      paginatedPromise,
      aggregatesPromise ?? Promise.resolve(null),
    ]);

    const transformed = paginatedResult.cars.map(transformCar);

    const nextCursor = paginatedResult.hasMore
      ? btoa(JSON.stringify({ offset: offset + rawPageSize }))
      : null;

    const response: Record<string, unknown> = {
      auctions: transformed,
      nextCursor,
      hasMore: paginatedResult.hasMore,
    };

    // Include exact total count for the current query filters (family + region)
    if (paginatedResult.totalCount !== undefined) {
      response.totalCount = paginatedResult.totalCount;
    }

    if (aggregatesResult) {
      response.aggregates = {
        liveNow: aggregatesResult.liveNow,
        regionTotals: aggregatesResult.regionTotalsByPlatform,
      };
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
      },
    });
  }

  // ─── Non-paginated path (dashboard / legacy) ───

  const [live, aggregates, seriesCounts] = await Promise.all([
    fetchLiveListingsAsCollectorCars({
      // Per-source budget — queryListingsMany fetches up to this many per marketplace
      // then interleaves so every region (US/EU/UK/JP) has data.
      limit: PER_SOURCE_BUDGET,
      includePriceHistory: false,
      make: requestedMake,
      includeAllSources: true,
    }),
    fetchLiveListingAggregateCounts({ make: requestedMake }),
    fetchSeriesCounts(requestedMake ?? "Porsche"),
  ]);

  // Hard guard: only active listings are ever shown on the dashboard.
  // The DB already filters this, but we enforce it here as a safety net.
  let results: CollectorCar[] = live.filter(
    car => car.status === "ACTIVE" || car.status === "ENDING_SOON"
  );

  // Apply filters
  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(car =>
      car.title.toLowerCase().includes(lowerQuery) ||
      car.make.toLowerCase().includes(lowerQuery) ||
      car.model.toLowerCase().includes(lowerQuery)
    );
  }

  if (filter === "top-picks") {
    results = results.filter(car => car.investmentGrade === "AAA");
  } else if (filter === "live") {
    results = results.filter(car => car.status === "ACTIVE" || car.status === "ENDING_SOON");
  } else if (filter === "ending-soon") {
    results = results.filter(car => car.status === "ENDING_SOON");
  }

  if (make && make !== "All Makes") {
    results = results.filter(car => car.make === make);
  }

  if (grade) {
    results = results.filter(car => car.investmentGrade === grade as InvestmentGrade);
  }

  if (status && status !== "All Statuses") {
    const statusMap: Record<string, string[]> = {
      "Live": ["ACTIVE", "ENDING_SOON"],
      "Ended": ["ENDED"],
      "ACTIVE": ["ACTIVE"],
      "ENDING_SOON": ["ENDING_SOON"],
      "ENDED": ["ENDED"]
    };
    const validStatuses = statusMap[status] || [];
    if (validStatuses.length > 0) {
      results = results.filter(car => validStatuses.includes(car.status));
    }
  }

  if (platform && platform !== "All Platforms") {
    results = results.filter(car => car.platform === platform);
  }

  if (category) {
    results = results.filter(car => car.category === category);
  }

  // Sorting
  results.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "price":
      case "currentBid":
        comparison = a.currentBid - b.currentBid;
        break;
      case "year":
        comparison = a.year - b.year;
        break;
      case "endTime":
        comparison = new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
        break;
      case "trendValue":
        comparison = a.trendValue - b.trendValue;
        break;
      case "bidCount":
        comparison = a.bidCount - b.bidCount;
        break;
      default:
        comparison = new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    }
    return sortOrder === "desc" ? -comparison : comparison;
  });

  const total = results.length;

  // Transform — keep only first image per listing to reduce payload size
  const transformed = results.map(transformCar);

  const body = {
    auctions: transformed,
    total,
    page: 1,
    limit: total,
    totalPages: 1,
    aggregates: {
      liveNow: aggregates.liveNow,
      regionTotals: aggregates.regionTotalsByPlatform,
      seriesCounts,
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
    },
  });
}

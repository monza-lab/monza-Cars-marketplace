import { NextRequest, NextResponse } from "next/server";
import {
  CURATED_CARS,
  searchCars,
  getTopPicks,
  getLiveAuctions,
  getEndingSoon,
  getCarsByMake,
  getCarsByGrade,
  type CollectorCar,
  type InvestmentGrade
} from "@/lib/curatedCars";
import { fetchLiveListingsAsCollectorCars } from "@/lib/supabaseLiveListings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Query parameters
  const query = searchParams.get("query") || "";
  const filter = searchParams.get("filter") || "";
  const make = searchParams.get("make") || "";
  const grade = searchParams.get("grade") || "";
  const status = searchParams.get("status") || "";
  const platform = searchParams.get("platform") || "";
  const category = searchParams.get("category") || "";
  const sortBy = searchParams.get("sortBy") || "endTime";
  const sortOrder = searchParams.get("sortOrder") || "asc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "24");

  const live = await fetchLiveListingsAsCollectorCars();

  // STRICT REQUIREMENT: "remove all the cars from the ui that are not the ferraris coming from the supabase database"
  // 1. We ONLY use `live` (Supabase) data.
  // 2. We FILTER `live` to only include Ferraris.
  let results: CollectorCar[] = live.filter(car => car.make.toLowerCase() === "ferrari");

  // Apply filters
  if (query) {
    const lowerQuery = query.toLowerCase();
    results = results.filter(car =>
      car.title.toLowerCase().includes(lowerQuery) ||
      car.make.toLowerCase().includes(lowerQuery) ||
      car.model.toLowerCase().includes(lowerQuery)
    );
  }

  // Note: The 'filter' param (top-picks, live, ending-soon) logic below is simplified 
  // because we are now restricted to ONLY Supabase Ferraris.
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

  // Pagination
  const total = results.length;
  const startIndex = (page - 1) * limit;
  const paginatedResults = results.slice(startIndex, startIndex + limit);

  // Transform to match existing API format
  const transformed = paginatedResults.map(car => ({
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
    currentBid: car.currentBid,
    finalPrice: car.status === "ENDED" ? car.currentBid : null,
    bidCount: car.bidCount,
    endTime: car.endTime.toISOString(),
    images: car.images,
    sourceUrl: car.sourceUrl ?? `https://example.com/auction/${car.id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Extended fields
    investmentGrade: car.investmentGrade,
    thesis: car.thesis,
    trend: car.trend,
    trendValue: car.trendValue,
    history: car.history,
    category: car.category,
    region: car.region,
    fairValueByRegion: car.fairValueByRegion
  }));

  return NextResponse.json({
    auctions: transformed,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateSourceImageCompleteness } from "@/components/dashboard/utils/aggregation";

const ADMIN_EMAILS = ["caposk8@hotmail.com"];

export const dynamic = "force-dynamic";

const FIELDS = [
  "vin", "trim", "engine", "transmission", "mileage",
  "color_exterior", "color_interior", "body_style",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json(
      { status: 401, code: "AUTH_REQUIRED", message: "Admin access required" },
      { status: 401 }
    );
  }

  // Query field completeness per source (active listings only)
  // Note: For ~30k rows this is acceptable. If listings grow significantly,
  // migrate to a Supabase RPC function (see spec Section 6A).
  const { data: rows, error } = await supabase
    .from("listings")
    .select("source,vin,trim,engine,transmission,mileage,mileage_km,color_exterior,color_interior,body_style,current_bid,images")
    .eq("status", "active");

  if (error) {
    return NextResponse.json(
      { status: 500, code: "QUERY_ERROR", message: error.message },
      { status: 500 }
    );
  }

  const imageCompletenessBySource = new Map(
    aggregateSourceImageCompleteness(rows ?? []).map((row) => [row.source, row])
  );

  // Aggregate by source
  const bySource: Record<string, {
    total: number;
    fields: Record<string, number>;
  }> = {};

  for (const row of rows ?? []) {
    const src = row.source as string;
    if (!bySource[src]) {
      bySource[src] = { total: 0, fields: {} };
      for (const f of [...FIELDS, "price", "images"]) {
        bySource[src].fields[f] = 0;
      }
    }
    bySource[src].total++;

    for (const f of FIELDS) {
      if (f === "mileage") {
        if ((row.mileage != null && row.mileage !== "") || (row.mileage_km != null && row.mileage_km !== "")) {
          bySource[src].fields[f]++;
        }
        continue;
      }
      if (row[f] != null && row[f] !== "") bySource[src].fields[f]++;
    }
    if (row.current_bid != null && row.current_bid > 0) bySource[src].fields.price++;
    if (row.images != null && Array.isArray(row.images) && row.images.length > 0) {
      bySource[src].fields.images++;
    }
  }

  // Convert to percentages
  const result = Object.entries(bySource).map(([source, { total, fields }]) => {
    const imageCompleteness = imageCompletenessBySource.get(source);
    return {
      source,
      total,
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 1000) / 10 : 0])
      ),
      imageCompleteness: imageCompleteness
        ? {
            withImages: imageCompleteness.withImages,
            missingImages: imageCompleteness.missingImages,
            percentage: imageCompleteness.percentage,
          }
        : {
            withImages: 0,
            missingImages: total,
            percentage: 0,
          },
    };
  });

  result.sort((a, b) => a.source.localeCompare(b.source));

  return NextResponse.json({
    status: 200,
    code: "OK",
    data: result,
    generatedAt: new Date().toISOString(),
  });
}

import { NextResponse } from "next/server";

import {
  buildAssuranceReport,
  fetchActiveListings,
} from "@/features/scrapers/common/assurance/database";
import { ASSURANCE_SOURCES } from "@/features/scrapers/common/assurance/manifest";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["caposk8@hotmail.com", "caposk817@gmail.com"];

export const dynamic = "force-dynamic";

const FIELDS = [
  "vin", "trim", "engine", "transmission", "mileage",
  "color_exterior", "color_interior", "body_style",
] as const;
const PLACEHOLDERS = new Set(["unknown", "n/a", "not specified", "-"]);

function present(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value !== "string") return value !== null && value !== undefined;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !PLACEHOLDERS.has(normalized);
}

function positive(value: unknown): boolean {
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) && number > 0;
}

function validImages(value: unknown): boolean {
  return Array.isArray(value) && value.some((candidate) => {
    if (typeof candidate !== "string") return false;
    try {
      const url = new URL(candidate);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

export async function GET() {
  const supabase = await createClient();
  if (process.env.NODE_ENV !== "development") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
      return NextResponse.json(
        { status: 401, code: "AUTH_REQUIRED", message: "Admin access required" },
        { status: 401 },
      );
    }
  }

  let rows;
  try {
    rows = await fetchActiveListings();
  } catch (error) {
    return NextResponse.json(
      { status: 500, code: "QUERY_ERROR", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }

  const report = buildAssuranceReport(rows);
  const contractBySource = new Map(report.sources.map((source) => [source.source, source]));
  const bySource = new Map(ASSURANCE_SOURCES.map((source) => [source.id, {
    total: 0,
    fields: Object.fromEntries([...FIELDS, "price", "images"].map((field) => [field, 0])) as Record<string, number>,
  }]));

  for (const row of rows) {
    if (!row.source || !bySource.has(row.source as (typeof ASSURANCE_SOURCES)[number]["id"])) continue;
    const aggregate = bySource.get(row.source as (typeof ASSURANCE_SOURCES)[number]["id"])!;
    aggregate.total += 1;
    for (const field of FIELDS) {
      if (present(row[field])) aggregate.fields[field] += 1;
    }
    if ([row.listing_price, row.current_bid, row.hammer_price, row.final_price, row.sold_price].some(positive)) {
      aggregate.fields.price += 1;
    }
    if (validImages(row.images)) aggregate.fields.images += 1;
  }

  const result = Array.from(bySource.entries()).map(([source, { total, fields }]) => {
    const contract = contractBySource.get(source)!;
    const withImages = fields.images;
    return {
      source,
      total,
      ...Object.fromEntries(
        Object.entries(fields).map(([field, count]) => [
          field,
          total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        ]),
      ),
      imageCompleteness: {
        withImages,
        missingImages: Math.max(0, total - withImages),
        percentage: total > 0 ? Math.round((withImages / total) * 1000) / 10 : 0,
      },
      rawCompleteness: contract.rawCompletenessPct,
      contractResolution: contract.contractResolutionPct,
      unresolvedFields: contract.unresolvedFields,
      verifiedUnavailableFields: contract.unavailableFields,
    };
  }).sort((a, b) => a.source.localeCompare(b.source));

  return NextResponse.json({
    status: 200,
    code: "OK",
    data: result,
    generatedAt: new Date().toISOString(),
  });
}

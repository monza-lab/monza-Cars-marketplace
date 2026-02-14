import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "8")));

  if (!query.trim()) {
    return NextResponse.json({ results: [] }, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ results: [] }, { status: 500 });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Case-insensitive search across make, model, and a constructed title (year + make + model)
    const pattern = `%${query}%`;
    const { data, error } = await supabase
      .from("listings")
      .select("id,year,make,model,trim,source,source_url,status,hammer_price,photos_media(photo_url)")
      .or(`make.ilike.${pattern},model.ilike.${pattern}`)
      .order("sale_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[search] Supabase error:", error.message);
      return NextResponse.json({ results: [] }, { status: 500 });
    }

    const results = (data ?? []).map((row: any) => {
      const photos = (row.photos_media ?? [])
        .map((p: any) => p.photo_url)
        .filter((u: string | null): u is string => typeof u === "string" && u.length > 0);
      const price = row.hammer_price != null ? Number(row.hammer_price) || 0 : 0;

      return {
        id: `live-${row.id}`,
        title: `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`,
        make: row.make,
        model: row.model,
        year: row.year,
        currentBid: price,
        image: photos[0] ?? "/cars/placeholder.jpg",
        status: row.status,
        platform: row.source,
        sourceUrl: row.source_url,
      };
    });

    return NextResponse.json({ results }, {
      headers: { "Cache-Control": "public, s-maxage=30" },
    });
  } catch (err) {
    console.error("[search] Failed:", err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}

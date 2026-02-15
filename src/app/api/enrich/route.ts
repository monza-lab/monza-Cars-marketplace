import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/enrich
 *
 * Batch enrichment job that:
 * 1. Computes fair value ranges from comparable sales (same make/model/year-range)
 * 2. Generates investment thesis using Claude API (if ANTHROPIC_API_KEY is set)
 *
 * Protected by CRON_SECRET.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const errors: string[] = [];
  let fairValuesComputed = 0;
  let thesesGenerated = 0;

  // Step 1: Compute fair values from comparable sales
  try {
    const { data: listings } = await supabase
      .from("listings")
      .select("id,make,model,year,hammer_price,status")
      .not("hammer_price", "is", null)
      .eq("status", "sold");

    if (listings && listings.length > 0) {
      // Group by make+model
      const groups = new Map<string, Array<{ id: string; year: number; price: number }>>();
      for (const l of listings) {
        const key = `${l.make}|${l.model}`;
        const existing = groups.get(key) ?? [];
        existing.push({ id: l.id, year: l.year, price: Number(l.hammer_price) });
        groups.set(key, existing);
      }

      for (const [, entries] of groups) {
        if (entries.length < 2) continue;

        const prices = entries.map((e) => e.price).sort((a, b) => a - b);
        const p25 = prices[Math.floor(prices.length * 0.25)] ?? prices[0];
        const p75 = prices[Math.floor(prices.length * 0.75)] ?? prices[prices.length - 1];

        // Update each listing in this group with fair value ranges
        for (const entry of entries) {
          const yearRange = entries
            .filter((e) => Math.abs(e.year - entry.year) <= 5)
            .map((e) => e.price)
            .sort((a, b) => a - b);

          const low = yearRange.length >= 2
            ? yearRange[Math.floor(yearRange.length * 0.25)] ?? p25
            : p25;
          const high = yearRange.length >= 2
            ? yearRange[Math.floor(yearRange.length * 0.75)] ?? p75
            : p75;

          // Store fair values in pricing table
          await supabase.from("pricing").upsert(
            {
              listing_id: entry.id,
              fair_value_low_usd: low,
              fair_value_high_usd: high,
              fair_value_low_eur: Math.round(low * 0.92),
              fair_value_high_eur: Math.round(high * 0.92),
              fair_value_low_gbp: Math.round(low * 0.79),
              fair_value_high_gbp: Math.round(high * 0.79),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "listing_id" }
          );
          fairValuesComputed++;
        }
      }
    }
  } catch (err) {
    errors.push(`Fair value computation: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Generate investment thesis using Claude API (if available)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const { data: listingsWithoutThesis } = await supabase
        .from("listings")
        .select("id,year,make,model,trim,hammer_price,status,description_text,auction_house")
        .is("investment_thesis", null)
        .limit(10); // Process 10 at a time

      for (const listing of listingsWithoutThesis ?? []) {
        try {
          const carName = `${listing.year} ${listing.make} ${listing.model}${listing.trim ? ` ${listing.trim}` : ""}`;
          const price = listing.hammer_price
            ? `$${Number(listing.hammer_price).toLocaleString()}`
            : "price unknown";

          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              messages: [
                {
                  role: "user",
                  content: `Write a 2-3 sentence investment thesis for this collector car: ${carName}, sold at ${listing.auction_house ?? "auction"} for ${price}. Status: ${listing.status}. ${listing.description_text ? `Description: ${listing.description_text.slice(0, 500)}` : ""}. Focus on market positioning, rarity, and investment potential. Be concise and factual.`,
                },
              ],
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const thesis = result.content?.[0]?.text ?? null;

            if (thesis) {
              await supabase
                .from("listings")
                .update({ investment_thesis: thesis })
                .eq("id", listing.id);
              thesesGenerated++;
            }
          }
        } catch {
          // Non-critical: skip this listing
        }
      }
    } catch (err) {
      errors.push(`Thesis generation: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    fairValuesComputed,
    thesesGenerated,
    errors,
  });
}

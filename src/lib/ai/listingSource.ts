import { createClient } from "@supabase/supabase-js"
import type { RewriterSource } from "./sourceHash"

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing")
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Load the minimum fields the rewriter needs for a live listing.
 * Returns null when the listing does not exist in Supabase.
 * `listingId` is the app-level id WITHOUT the `live-` prefix.
 */
export async function loadListingSource(
  listingIdWithoutPrefix: string,
): Promise<RewriterSource | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from("listings")
    .select(
      "year, make, model, trim, mileage, mileage_unit, vin, color_exterior, color_interior, engine, transmission, body_style, location, platform, description_text",
    )
    .eq("id", listingIdWithoutPrefix)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    year: Number(data.year),
    make: String(data.make ?? ""),
    model: String(data.model ?? ""),
    trim: (data.trim as string | null) ?? null,
    mileage: data.mileage != null ? Number(data.mileage) : null,
    mileage_unit: (data.mileage_unit as "mi" | "km" | null) ?? null,
    vin: (data.vin as string | null) ?? null,
    color_exterior: (data.color_exterior as string | null) ?? null,
    color_interior: (data.color_interior as string | null) ?? null,
    engine: (data.engine as string | null) ?? null,
    transmission: (data.transmission as string | null) ?? null,
    body_style: (data.body_style as string | null) ?? null,
    location: (data.location as string | null) ?? null,
    platform: (data.platform as string | null) ?? null,
    description_text: (data.description_text as string | null) ?? null,
  }
}

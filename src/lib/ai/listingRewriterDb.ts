import { createClient } from "@supabase/supabase-js"

export interface CachedRewriteRow {
  headline: string
  highlights: string[]
  source_hash: string
  prompt_version: string
  model: string
  generated_at: string
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function readCachedRewrite(
  listingId: string,
  locale: string,
): Promise<CachedRewriteRow | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("listing_translations")
    .select("headline, highlights, source_hash, prompt_version, model, generated_at")
    .eq("listing_id", listingId)
    .eq("locale", locale)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    headline: data.headline as string,
    highlights: data.highlights as string[],
    source_hash: data.source_hash as string,
    prompt_version: data.prompt_version as string,
    model: data.model as string,
    generated_at: data.generated_at as string,
  }
}

export async function writeCachedRewrite(
  listingId: string,
  locale: string,
  row: CachedRewriteRow,
): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase.from("listing_translations").upsert({
    listing_id: listingId,
    locale,
    headline: row.headline,
    highlights: row.highlights,
    source_hash: row.source_hash,
    prompt_version: row.prompt_version,
    model: row.model,
    generated_at: row.generated_at,
  })
  if (error) throw error
}

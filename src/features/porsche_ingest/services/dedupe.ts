import type { CanonicalListing } from "../contracts/listing";

export function dedupeListings(listings: CanonicalListing[]): CanonicalListing[] {
  const seen = new Set<string>();
  const output: CanonicalListing[] = [];

  for (const listing of listings) {
    const key = `${listing.source}:${listing.source_id}:${listing.source_url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(listing);
  }

  return output;
}

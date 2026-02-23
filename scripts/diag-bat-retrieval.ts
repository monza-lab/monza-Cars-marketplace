import { existsSync, readFileSync } from "node:fs";

import { fetchSourceItems } from "../src/features/porsche_ingest/adapters/sources";

function loadEnv(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.slice(2).find((entry) => entry.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  return fallback;
}

function idOf(raw: Record<string, unknown>): string {
  const value = raw.source_id ?? raw.sourceId ?? raw.external_id ?? raw.externalId ?? raw.id ?? raw.auctionId ?? raw.listingId;
  return value == null ? "" : String(value);
}

function urlOf(raw: Record<string, unknown>): string {
  const value = raw.auctionUrl ?? raw.url ?? raw.source_url ?? raw.sourceUrl ?? raw.listingUrl ?? raw.link;
  return value == null ? "" : String(value);
}

async function main(): Promise<void> {
  loadEnv(".env.local");
  loadEnv(".env");

  const limit = Number(arg("limit", "500"));
  const startUrl = arg("startUrl", "https://bringatrailer.com/auctions/results/?search=porsche");
  const mode = (arg("mode", "sample") ?? "sample") as "sample" | "incremental" | "backfill";

  const items = await fetchSourceItems({
    source: "bat",
    mode,
    limit,
    batMaxItems: limit,
    batStartUrl: startUrl,
  });

  const ids = items.map(idOf).filter((id) => id.length > 0);
  const uniqueIds = new Set(ids);
  const urls = items.map(urlOf).filter((url) => url.length > 0);

  console.log(JSON.stringify({
    startUrl,
    mode,
    requestedMaxItems: limit,
    fetched: items.length,
    idsTotal: ids.length,
    uniqueIds: uniqueIds.size,
    firstId: ids[0] ?? null,
    lastId: ids[ids.length - 1] ?? null,
    firstUrl: urls[0] ?? null,
    lastUrl: urls[urls.length - 1] ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

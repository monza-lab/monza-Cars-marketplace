# Classic.com Collector

Scrapes live Porsche listings from [classic.com](https://www.classic.com) US market.

## Architecture

```
cli.ts → collector.ts → discover.ts → detail.ts → normalize.ts → supabase_writer.ts
                           ↓               ↓
                      browser.ts      browser.ts
                    (Playwright)     (Playwright)
```

### Key Differences from BeForward/AutoTrader Collectors

| Aspect | BeForward/AutoTrader | Classic.com |
|--------|---------------------|-------------|
| HTTP | `fetch()` + Cheerio | **Playwright** (Cloudflare WAF) |
| Discovery | HTML parsing / GraphQL POST | Browser navigation + GraphQL intercept |
| Detail | Direct HTTP fetch | Browser navigation + GraphQL intercept |
| Fallback | N/A | `__NUXT__` data → DOM parsing |
| Source | Single platform | **Aggregator** (BaT, RM Sotheby's, Mecum, etc.) |
| SourceId | RefNo / AdvertId | **VIN-based** (cross-platform dedup) |

### Data Flow

1. **Discover**: Navigate search pages, intercept GraphQL responses from `graphql-prod.classic.com`
2. **Detail**: Navigate each listing page, intercept vehicle GraphQL response
3. **Normalize**: Map raw data to `NormalizedListing` schema, parse US locations, map auction houses
4. **Write**: Upsert to Supabase `listings` table + `price_history` snapshots

### Source Attribution

- `source` field = `"ClassicCom"` (for DB uniqueness)
- `auction_house` field = **original platform** (e.g., "Bring a Trailer", "Mecum Auctions")
- `sourceId` = `classic-{VIN}` (enables cross-platform dedup)

## Usage

```bash
# Dry run with visible browser (debug):
npx tsx src/features/classic_collector/cli.ts --dryRun --headed --maxListings=5

# Production run:
npx tsx src/features/classic_collector/cli.ts --maxPages=20 --maxListings=500

# With proxy:
npx tsx src/features/classic_collector/cli.ts --proxyServer=http://gate.smartproxy.com:7000
```

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional: Decodo/SmartProxy residential proxies
DECODO_PROXY_URL=http://gate.smartproxy.com:7000
DECODO_PROXY_USER=user-country-us
DECODO_PROXY_PASS=your_password
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--make` | Porsche | Make to search |
| `--location` | US | Location filter |
| `--maxPages` | 10 | Max search pages |
| `--maxListings` | 500 | Max listings to process |
| `--headed` | false | Show browser window |
| `--dryRun` | false | Skip DB writes |
| `--navigationDelayMs` | 3000 | Delay between pages (ms) |
| `--pageTimeoutMs` | 30000 | Page load timeout (ms) |

## Output

- **JSONL**: `var/classic_collector/listings.jsonl` — all normalized listings
- **Checkpoint**: `var/classic_collector/checkpoint.json` — resume interrupted runs
- **Supabase**: `listings` + `price_history` tables

## Deduplication Strategy

The collector writes all listings with `source = "ClassicCom"`. A separate dedup job (future) handles cross-source duplicates by matching on the `vin` column.

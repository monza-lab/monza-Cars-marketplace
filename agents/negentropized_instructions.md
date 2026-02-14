# Goal
Build a minimal-dependency sync job that collects all Ferrari listings from the existing scrapers (Bring a Trailer, Cars & Bids, Collecting Cars), including active listings and ended listings from the last 90 days (plus historic sold results and bid snapshots when available), and writes them idempotently into Supabase tables that match `BASE_DATOS_COMPLETA_TODOS_LUJO.md`.

# Primary User / Actor
A Monza engineer (and a daily cron job) runs a CLI sync script to backfill and incrementally refresh Ferrari auction listings into the Supabase Postgres schema.

# Inputs
Required:
- Supabase credentials available at runtime:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (preferred for writes; otherwise RLS must allow inserts/updates)
- Access to the existing scrapers for:
  - Bring a Trailer (BaT)
  - Cars & Bids
  - Collecting Cars
- Run parameters:
  - `mode`: `daily` | `backfill`
  - `ended_window_days` (default `90` for daily)
  - `date_from`/`date_to` for backfill (ISO `YYYY-MM-DD`)

Optional:
- Concurrency/rate limit parameters per source (defaults should be conservative).
- FX conversion inputs for filling `price_usd/price_eur/price_gbp` (can be deferred; see Data Contracts).
- Bid history/snapshot support (only if current scrapers already expose it; no new sources).

# Outputs / Deliverables
Database writes (Supabase tables defined in `BASE_DATOS_COMPLETA_TODOS_LUJO.md`):
- `listings`: one row per unique auction listing
- `pricing`: 0/1 row per listing
- `auction_info`: 0/1 row per listing
- `location_data`: 0/1 row per listing
- `photos_media`: 0..N rows per listing
- `price_history`: 0..N time-series snapshots per listing (when current price/bid/hammer is known)
- `vehicle_specs`, `provenance_data`, `vehicle_history`: placeholders only unless existing scrapers already provide data

Code deliverables to be implemented later (do not implement in this phase):
- Feature folder (vertical slice): `src/features/ferrari_supabase_sync/`
- CLI entrypoint to run `daily` and `backfill` modes
- Pure normalizers + idempotency helpers with unit tests co-located

Deliverables inventory (targets):
- Files (suggested):
  - `src/features/ferrari_supabase_sync/README.md` (runbook + env vars)
  - `src/features/ferrari_supabase_sync/sync.ts` (orchestrator)
  - `src/features/ferrari_supabase_sync/map_to_db.ts` (table mapping)
  - `src/features/ferrari_supabase_sync/normalizers.ts` (mileage/currency/location/status/Ferrari detection)
  - `src/features/ferrari_supabase_sync/idempotency.ts` (stable keys)
  - `src/features/ferrari_supabase_sync/normalizers.test.ts` (unit tests)
- LOC/file target: 150-350 LOC/file (split only when needed; avoid > 1000 LOC/file)
- Dependencies (budget: 1):
  - `@supabase/supabase-js`

# Core Pipeline
1. Select execution mode:
   - `daily`: fetch all active Ferrari listings + all ended Ferrari listings with `sale_date` in last `ended_window_days` (default 90).
   - `backfill`: fetch ended Ferrari listings within `[date_from, date_to]` (inclusive), optionally with a flag to also collect bid snapshots where available.
2. For each source (BaT, Cars & Bids, Collecting Cars), run existing scraper(s) to produce a per-listing payload containing at minimum: `source_id`, `source_url`, `title`, `status`, `end_date` (or close date), and any price/bid fields the scraper already exposes.
3. Filter to Ferrari listings using the Ferrari detection contract (Data Quality rules).
4. Normalize into a canonical in-memory record (units, currency, dates, location parsing, status mapping).
5. Compute idempotency keys:
   - Primary: `(source, source_id)`
   - Secondary: `source_url`
6. Write to Supabase in a deterministic order (idempotent upserts):
   - Upsert `listings` first to obtain/resolve `listing_id`.
   - Upsert 1:1 tables: `pricing`, `auction_info`, `location_data`, `vehicle_specs`, `provenance_data` (as applicable).
   - Upsert/insert 1:N tables: `photos_media`, `price_history`.
7. Observability:
   - Emit structured logs per run + per listing (counts, durations, retries, upserts vs inserts).
   - Persist a run summary (can be log-only initially).

# Data / Evidence Contracts
This project is data-ingestion (not research/citation). Evidence gating is not required, but the ingestion must be explicit about field provenance and nullability.

Canonical normalized record (minimum fields):
- `source`: enum-like string: `BaT` | `CarsAndBids` | `CollectingCars`
- `source_id`: stable listing identifier from the source (string)
- `source_url`: canonical URL (string)
- `title`: listing title (string)
- `year`: integer (>=1900)
- `make`: must normalize to `Ferrari`
- `model`: best-effort model name
- `trim`: best-effort variant/series
- `status`: normalized to `active` | `sold` | `unsold` | `delisted`
- `list_date`: ISO date (best-effort; may be null if not available)
- `sale_date`: ISO date
- `location_raw`: raw location text (string)
- `country`, `region`, `city`: parsed best-effort
- Price/bid fields (best-effort):
  - `original_currency`: `USD` | `EUR` | `GBP` | `JPY` | `CHF` (use doc enum set)
  - `hammer_price` (ended/sold)
  - `current_bid` (active)
  - `buyers_premium_percent` (rare for these 3 sources; null if not provided)
- `photos`: array of URLs (optional)
- `scrape_timestamp`: ISO timestamp

Mapping strategy: source payload -> Supabase tables

Table: `listings` (core)
- Populate now (from current scrapers, best-effort):
  - `source`:
    - BaT -> `BaT`
    - Cars & Bids -> `CarsAndBids`
    - Collecting Cars -> `CollectingCars`
  - `source_id`: source-native listing ID/slug/auction ID
  - `source_url`: canonical listing URL
  - `year`: parse from title or structured field
  - `make`: `Ferrari` (enforced by detection; do not ingest if not confidently Ferrari)
  - `model`, `trim`: parse from title/structured fields
  - `body_style`: if scraper exposes; else null
  - `color_exterior`, `color_interior`: if exposed; else null
  - `mileage`, `mileage_unit`: normalize mileage to integer kilometers and set `mileage_unit='km'` (see normalization rules)
  - `vin`: if exposed; else null
  - `condition_description`: null unless scrapers already provide a dedicated field
  - `description_text`: full description if available; else null
  - `photos_count`: derived from `photos.length` when photos are available
  - `auction_house`: for these sources, set to the source name (e.g. `Bring a Trailer`, `Cars & Bids`, `Collecting Cars`)
  - `auction_date`: best-effort; for online auctions can equal `sale_date` (close date)
  - `sale_date`: required; use close/end date for ended, and scheduled close date for active
  - `list_date`: listing start date when available; else first-seen date for the listing
  - `status`: mapped as defined below
  - `reserve_met`: if provided by scraper; else null
  - `hammer_price`: for sold listings; null for active/unsold
  - `original_currency`: if price is known; else null
  - `estimate_low`, `estimate_high`: typically not available for these sources; default null
  - `buyers_premium_percent`: typically not available for these sources; default null
  - `country` (NOT NULL): parsed from location; fallback to `'Unknown'` if parsing fails
  - `region`, `city`: parsed best-effort
  - `latitude`, `longitude`: null (unless existing scrapers already geocode)
  - `seller_name`, `seller_contact`: null (do not scrape new private info)
  - `scrape_timestamp`: set to run timestamp
  - `data_quality_score`: computed based on presence of critical fields (see Quality rules)
- Leave null placeholders for now:
  - `price_usd`, `price_eur`, `price_gbp` (until FX normalization is introduced)
  - Hagerty condition fields: `hagerty_grade`, `original_vs_restored`, `matching_numbers`
  - Provenance fields: `racing_history`, `famous_owner`, etc

Table: `pricing` (1:1)
- Populate now:
  - `listing_id`: FK from `listings`
  - `hammer_price_original`: map from `hammer_price` when sold
  - `original_currency`: from normalized currency
  - `buyers_premium_percent`: null unless source provides
- Leave null placeholders:
  - `price_usd/price_eur/price_gbp`, `buyers_premium_amount`, `total_price_to_buyer`, seller estimates

Table: `auction_info` (1:1)
- Populate now:
  - `listing_id`
  - `auction_house`: set to human-readable source
  - `auction_date`: set to `sale_date` (close date) where available
  - `lot_number`: for online auctions, store `source_id` (string)
  - `reserve_met`: if scraper provides; else null
  - `pre_sale_estimate_low/high`: null (not typically provided)
  - `hammer_price`: map from sold price
  - `status`: map to `sold` | `unsold` | `passed` | `withdrawn` (withdrawn rarely available; default null)
  - `number_of_bids`: if scraper provides; else null
  - `starting_bid`: if scraper provides; else null

Table: `location_data` (1:1)
- Populate now:
  - `listing_id`
  - `country` (NOT NULL): parsed; fallback `'Unknown'`
  - `region`, `city`, `postal_code`: parsed best-effort
- Leave null placeholders:
  - `country_code`, `region_code`, `latitude/longitude`, `timezone`, market enrichment fields

Table: `photos_media` (1:N)
- Populate now (if scrapers provide photo URLs):
  - `listing_id`
  - `photo_url`
  - `photo_order`: preserve order from source gallery when available
  - `photo_category`: null (unless source explicitly labels)
  - `photo_hash`: compute SHA256 of `photo_url` for dedup within listing (no external deps)
- Leave null placeholders:
  - `local_cache_path`, image dimension/quality fields, analysis fields

Table: `price_history` (time-series)
- Populate now only when price/bid is directly known AND currency is one of the schema enums:
  - `time`: `scrape_timestamp`
  - `listing_id`
  - `status`: from normalized listing status
  - `price_usd`: set only if original currency is USD and amount is known
  - `price_eur`: set only if original currency is EUR and amount is known
  - `price_gbp`: set only if original currency is GBP and amount is known
- Note: for active listings, treat current bid as the snapshot price; for sold, treat hammer price as the snapshot price.

Other tables (placeholders unless existing scrapers already expose structured data):
- `vehicle_specs`: only fill fields confidently extracted (e.g., transmission) else leave null.
- `provenance_data`: do not infer; keep null/false defaults unless explicitly stated and reliably parsed.
- `vehicle_history`: out of scope without additional sources.

Execution modes
- `daily incremental sync`:
  - Fetch all active Ferrari listings (no date bound).
  - Fetch ended Ferrari listings where close/end date (`sale_date`) is within the last 90 days.
  - Upsert everything; append a `price_history` snapshot when a price/bid value is present.
- `backfill mode (date range)`:
  - For each source, iterate archive/search pages to cover ended listings in `[date_from, date_to]`.
  - Must be resumable (e.g., page-based checkpoints in logs).
- Idempotency keys and upsert contracts:
  - `listings`: unique key `(source, source_id)` (matches schema unique index); prefer upsert on that key.
  - `pricing`, `auction_info`, `location_data`, `vehicle_specs`, `provenance_data`: unique per `listing_id` (schema unique constraints); use upsert on `listing_id`.
  - `photos_media`: treat `(listing_id, photo_url)` as a natural key; if DB lacks a unique constraint, implement a pre-insert existence check or deterministic upsert by `photo_hash`.
  - `price_history`: treat `(listing_id, time)` as the natural key; if DB lacks a unique constraint, de-duplicate in app by skipping inserts when an identical snapshot exists within a small time bucket (e.g., same day/hour).

Data quality + normalization rules
- Ferrari detection (must pass to ingest):
  - If scraper provides structured `make`, accept only if it normalizes to `Ferrari`.
  - Else parse title for `\bFerrari\b` (case-insensitive) AND a plausible model token; reject if title contains any of: `replica`, `tribute`, `kit`, `rebody`, `Ferrari-powered` (unless make is structured as Ferrari).
  - Reject clearly non-car items (parts, posters) by keyword: `wheel`, `engine`, `poster`, `model car`, `toy`.
- Mileage normalization:
  - Parse common formats: `12,345 miles`, `12k mi`, `20 000 km`.
  - Convert miles to km using `1 mile = 1.609344 km`.
  - Store integer km in `listings.mileage` and set `mileage_unit='km'`.
- Currency normalization:
  - Map symbols/words to ISO-like enum: `$`/`USD` -> `USD`, `£`/`GBP` -> `GBP`, `€`/`EUR` -> `EUR`.
  - If currency unknown, leave `original_currency` null and keep converted fields null.
  - Do not guess FX conversions in this phase.
- Status mapping:
  - Source statuses must map to `listings.status`:
    - active: auction live / accepting bids
    - sold: ended + sold/closed with a realized price
    - unsold: ended + not sold / reserve not met / no sale
    - delisted: removed/cancelled/withdrawn
  - For `auction_info.status`: map to `sold` | `unsold` | `passed` | `withdrawn` with best-effort; default null if ambiguous.
- Location parsing -> `country/region/city`:
  - US patterns: `City, ST` -> country `USA`, region `ST`, city `City`.
  - UK patterns: `City`/`County` -> country `UK` when explicitly stated or implied by known UK regions.
  - Otherwise, parse trailing country token when present; if none, set `country='Unknown'`.
- `sale_date` and `list_date` rules:
  - `sale_date`:
    - Ended listings: use auction close date.
    - Active listings: use scheduled close date if available (must be scraped); otherwise, do not ingest (because `sale_date` is NOT NULL in schema).
  - `list_date`:
    - Use the listing start/post date if available.
    - Else set to first-seen date for the listing in the scraper output.

# Constraints
- Sources: ONLY the existing scrapers for BaT, Cars & Bids, Collecting Cars (no new sources yet).
- Stack:
  - Vanilla-first Node/TypeScript in this repo.
  - Dependency budget: 1 runtime dependency: `@supabase/supabase-js`.
- Code organization:
  - Vertical slice folder per feature: `src/features/ferrari_supabase_sync/`.
  - Keep mapping + normalizers + writer in the same feature folder.
  - Do not introduce shared utilities unless reused by 3+ features.
- Data safety:
  - Do not store secrets in repo; read Supabase credentials from env.
  - Do not scrape private seller contact details; keep `seller_contact` null.
- Writes must be idempotent:
  - Re-running `daily` for the same window must not duplicate listings or photos.

# Non-Goals / Backlog
- Adding additional sources (RM Sotheby's, Bonhams, Mecum, etc.).
- Building FX conversion service, historical exchange rates, or filling `price_usd/price_eur/price_gbp` beyond direct same-currency mapping.
- Geocoding, lat/long enrichment, timezone determination.
- Image downloading/caching, image quality scoring, or CV-based damage detection.
- Full provenance extraction (racing history, famous owners) unless already structured in current scraper outputs.
- Admin UI, dashboards, analytics queries, or alerts.

# Definition of Done
- `daily` mode:
  - Ingests all currently active Ferrari listings from the 3 sources.
  - Ingests all ended Ferrari listings with `sale_date` within the last 90 days.
  - Upserts `listings` by `(source, source_id)` without creating duplicates on repeated runs.
  - Writes `pricing`, `auction_info`, `location_data`, and `photos_media` where data is available.
  - Writes at least one `price_history` snapshot per listing when a bid/hammer price is available.
- `backfill` mode:
  - Accepts `date_from`/`date_to` and ingests ended Ferrari listings in that range.
  - Can be stopped/restarted without duplicating listings.
- Unit tests:
  - Normalizers covered: Ferrari detection, mileage parsing, currency parsing, status mapping, location parsing.
  - Idempotency covered: stable key generation for `(source, source_id)`.
- Smoke run (manual):
  - A small backfill window (e.g., 2-3 days) completes successfully and inserts rows in Supabase.
  - Logs include counts per source: fetched, Ferrari-kept, upserted, skipped, errored, retried.
- Operational readiness:
  - Rate limiting per source is configured (conservative defaults).
  - Retries on transient failures (429/5xx) with exponential backoff.
  - Cron schedule defined: run `daily` once per day (recommended 05:00 UTC).

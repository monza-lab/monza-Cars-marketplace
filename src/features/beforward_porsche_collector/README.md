# BeForward Porsche Collector

Scrapes all active Porsche listings from BeForward stocklist and detail pages.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Run

Dry-run full retrieval (recommended first):

```bash
npx tsx src/features/beforward_porsche_collector/cli.ts --dryRun --maxPages=200 --maxDetails=10000 --concurrency=6 --rateLimitMs=2500
```

Write to Supabase:

```bash
npx tsx src/features/beforward_porsche_collector/cli.ts --maxPages=200 --maxDetails=10000 --concurrency=6 --rateLimitMs=2500
```

Output artifacts:

- `var/beforward_porsche_collector/listings.jsonl`
- `var/beforward_porsche_collector/checkpoint.json`

# TS-AUTOTRADER-FULL-COVERAGE

## Objective
Capture full Porsche inventory from AutoTrader by model partition to bypass the gateway 100-page cap.

## Run

```bash
npm run test -- src/features/autotrader_collector/discover.test.ts src/features/autotrader_collector/collector.test.ts src/features/autotrader_collector/id.test.ts
npx tsx -e 'import { runCollector } from "./src/features/autotrader_collector/collector.ts"; /* load env then run model sweep */'
```

## Model Sweep

- Primary models: `911`, `Cayenne`, `Macan`, `Panamera`, `Boxster`, `Cayman`
- Secondary models: `Taycan`, `718 Boxster`, `718 Cayman`, `924`, `928`, `944`, `968`
- Collector args per model:
  - `mode: "daily"`
  - `make: "Porsche"`
  - `model: <model>`
  - `postcode: "SW1A 1AA"`
  - `maxActivePagesPerSource: 100`
  - `scrapeDetails: false`

## Verification SQL

```sql
select count(*) from public.listings where source='AutoTrader';
select count(distinct source_id) from public.listings where source='AutoTrader';
select source_id, title, scrape_timestamp from public.listings where source='AutoTrader' order by scrape_timestamp desc, created_at desc limit 10;
```

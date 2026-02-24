# TS-AUTOTRADER-GATEWAY-DAILY

## Objective

Validate AutoTrader Porsche daily collection via gateway API and Supabase persistence.

## Prerequisites

- `.env.local` contains Supabase URL/key values.
- Network access to `https://www.autotrader.co.uk/at-gateway`.

## Run

```bash
npm run test -- src/features/autotrader_collector/discover.test.ts src/features/autotrader_collector/collector.test.ts
npx tsx -e "import { readFileSync, existsSync } from 'node:fs'; import { runCollector } from './src/features/autotrader_collector/collector.ts'; const load=(p:string)=>{ if(!existsSync(p)) return; for(const line of readFileSync(p,'utf8').split(/\\r?\\n/)){ const t=line.trim(); if(!t||t.startsWith('#')) continue; const i=t.indexOf('='); if(i===-1) continue; const k=t.slice(0,i).trim(); if(process.env[k]!==undefined) continue; let v=t.slice(i+1).trim(); if((v.startsWith('\\\"')&&v.endsWith('\\\"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); process.env[k]=v; } }; (async()=>{ load('.env.local'); load('.env'); const res=await runCollector({ mode:'daily', make:'Porsche', dryRun:false, maxActivePagesPerSource:5, checkpointPath:'var/autotrader_collector/checkpoint-live.json' }); console.log('FINAL_RESULT=' + JSON.stringify(res)); })().catch((err)=>{ console.error(err); process.exit(1); });"
```

## Expected

- Test suite passes.
- Collector logs `collector.source_done` with `discovered > 0` and `written > 0`.
- `FINAL_RESULT` contains run ID and zero errors.

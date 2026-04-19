#!/usr/bin/env node
// End-to-end smoke test for /api/admin/data-quality/overview
// Replays the route's queries against the live DB via service role and
// prints: source statuses, alerts, maintenance table, unknown active runs.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const SOURCES = [
  { id: 'AutoScout24', label: 'AutoScout24', scraperNames: ['autoscout24'], maxRunMinutes: 60 },
  { id: 'AutoTrader', label: 'AutoTrader UK', scraperNames: ['autotrader', 'enrich-autotrader'], maxRunMinutes: 30 },
  { id: 'BaT', label: 'Bring a Trailer', scraperNames: ['porsche', 'ferrari', 'bat-detail'], maxRunMinutes: 45 },
  { id: 'BeForward', label: 'BeForward', scraperNames: ['beforward', 'enrich-beforward'], maxRunMinutes: 30 },
  { id: 'ClassicCom', label: 'Classic.com', scraperNames: ['classic'], maxRunMinutes: 30 },
  { id: 'Elferspot', label: 'Elferspot', scraperNames: ['elferspot', 'enrich-elferspot', 'backfill-photos-elferspot'], maxRunMinutes: 30 },
];
const MAINTENANCE = [
  { scraperName: 'backfill-images', label: 'Image backfill', maxRunMinutes: 45, expectedCadenceHours: 24 },
  { scraperName: 'enrich-vin', label: 'VIN enrichment', maxRunMinutes: 30, expectedCadenceHours: 24 },
  { scraperName: 'enrich-titles', label: 'Title enrichment', maxRunMinutes: 30, expectedCadenceHours: 24 },
  { scraperName: 'enrich-details', label: 'Detail enrichment', maxRunMinutes: 30, expectedCadenceHours: 24 },
  { scraperName: 'enrich-details-bulk', label: 'Bulk enrichment', maxRunMinutes: 120, expectedCadenceHours: 168 },
  { scraperName: 'validate', label: 'Validator', maxRunMinutes: 15, expectedCadenceHours: 24 },
  { scraperName: 'cleanup', label: 'Cleanup', maxRunMinutes: 10, expectedCadenceHours: 24 },
  { scraperName: 'liveness-check', label: 'Liveness', maxRunMinutes: 15, expectedCadenceHours: 24 },
];

const now = new Date();
const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
const oneDayAgo = new Date(now - 86400000).toISOString();

const [ingest, runs, actives] = await Promise.all([
  supa.from('v_source_ingestion').select('*'),
  supa
    .from('scraper_runs')
    .select('scraper_name, started_at, finished_at, success, duration_ms, discovered, written, errors_count')
    .gte('started_at', sevenDaysAgo)
    .order('started_at', { ascending: false }),
  supa.from('scraper_active_runs').select('*'),
]);

for (const r of [ingest, runs, actives]) {
  if (r.error) { console.error('ERROR:', r.error.message); process.exit(1); }
}

const bySource = new Map(ingest.data.map((r) => [r.source, r]));
const byScraper = new Map();
for (const r of runs.data) {
  if (!byScraper.has(r.scraper_name)) byScraper.set(r.scraper_name, []);
  byScraper.get(r.scraper_name).push(r);
}
const activeByScraper = new Map(actives.data.map((a) => [a.scraper_name, a]));

const toUtc = (iso) => /([Zz]|[+-]\d{2}:?\d{2})$/.test(iso) ? new Date(iso) : new Date(iso + 'Z');
const hoursSince = (iso) => iso ? (now - toUtc(iso)) / 3600000 : null;
const ageMin = (iso) => Math.round((now - toUtc(iso)) / 60000);

// Match route logic exactly (see src/app/api/admin/data-quality/overview/route.ts)
function classifySource(p) {
  const reasons = [];
  const fresh = p.hoursSinceLastListing != null && p.hoursSinceLastListing < 48;
  const veryStale = p.hoursSinceLastListing == null || p.hoursSinceLastListing > 72;
  if (veryStale) reasons.push({ level: 'red', msg: p.hoursSinceLastListing == null ? 'no listings' : `no new listings ${p.hoursSinceLastListing.toFixed(1)}h` });
  else if (!fresh) reasons.push({ level: 'yellow', msg: `last listing ${p.hoursSinceLastListing.toFixed(1)}h ago (>48h)` });
  if (p.anyStalledActiveRun) reasons.push({ level: 'yellow', msg: 'active run exceeded max runtime' });
  if (p.anyScraperFailedRecently) reasons.push({ level: 'yellow', msg: 'recent scraper run failed' });
  if (p.allScrapersSilentDays != null && p.allScrapersSilentDays > 2 && !fresh) reasons.push({ level: 'red', msg: `no runs ${p.allScrapersSilentDays}+ days + stale listings` });
  const level = reasons.some(r => r.level === 'red') ? 'RED' : reasons.some(r => r.level === 'yellow') ? 'YELLOW' : 'GREEN';
  return { level, reasons: reasons.map(r => r.msg) };
}

const allAlerts = [];
console.log(`\n=== SOURCES (${SOURCES.length}) ===`);
for (const def of SOURCES) {
  const ing = bySource.get(def.id);
  const hrs = hoursSince(ing?.last_listing_inserted_at);
  const scraperDetails = def.scraperNames.map((name) => {
    const list = byScraper.get(name) ?? [];
    const latest = list[0];
    const active = activeByScraper.get(name);
    let activeState = 'none';
    if (active) {
      const age = ageMin(active.started_at);
      if (age <= def.maxRunMinutes * 2) {
        activeState = 'running';
      } else {
        // Orphaned check: did listings for this source land inside the run's window?
        const lastInsert = ing?.last_listing_inserted_at;
        const startMs = toUtc(active.started_at).getTime();
        const windowEndMs = startMs + def.maxRunMinutes * 60_000;
        if (lastInsert) {
          const lm = toUtc(lastInsert).getTime();
          activeState = lm >= startMs && lm <= windowEndMs ? 'orphaned' : 'stalled';
        } else {
          activeState = 'stalled';
        }
      }
    }
    return { name, list, latest, active, activeState };
  });
  const { level: status, reasons } = classifySource({
    hoursSinceLastListing: hrs,
    anyScraperFailedRecently: scraperDetails.some(s => s.latest && s.latest.success === false),
    anyStalledActiveRun: scraperDetails.some(s => s.activeState === 'stalled'),
    allScrapersSilentDays: (() => {
      const times = scraperDetails.map(s => s.latest?.started_at).filter(Boolean);
      if (!times.length) return null;
      return Math.floor(Math.min(...times.map(t => hoursSince(t))) / 24);
    })(),
  });
  if (scraperDetails.some(s => s.activeState === 'orphaned') && !reasons.length) {
    reasons.push('active run stuck (recording bug); listings landed OK');
  }
  if (status !== 'GREEN') allAlerts.push({ level: status, scope: 'source', target: def.id, msg: reasons.join('; ') });
  console.log(`\n[${status}] ${def.label} (${def.id})${reasons.length ? '  — ' + reasons.join('; ') : ''}`);
  console.log(`  ingestion: ${ing?.total_active_listings ?? 0} active, +${ing?.new_24h ?? 0} (24h), +${ing?.new_7d ?? 0} (7d), last ${hrs?.toFixed(1)}h ago`);
  for (const { name, list, latest, active, activeState } of scraperDetails) {
    const activeStr = active ? ` ACTIVE(${ageMin(active.started_at)}m, ${activeState.toUpperCase()})` : '';
    const latestStr = latest ? `last ${hoursSince(latest.started_at).toFixed(1)}h ago, ${latest.success ? 'OK' : 'FAIL'}, wrote ${latest.written ?? '-'}` : 'NO RUNS';
    console.log(`    ${name.padEnd(30)} runs7d=${list.length.toString().padStart(3)}  fail7d=${list.filter(r=>!r.success).length.toString().padStart(2)}  ${latestStr}${activeStr}`);
    if (activeState === 'stalled') allAlerts.push({ level: 'YELLOW', scope: 'scraper', target: name, msg: `stalled ${ageMin(active.started_at)}m — no listings landed during window` });
    if (activeState === 'orphaned') allAlerts.push({ level: 'YELLOW', scope: 'scraper', target: name, msg: `orphaned ${ageMin(active.started_at)}m — listings landed, recording incomplete (collector bug)` });
  }
}

console.log(`\n=== MAINTENANCE JOBS (${MAINTENANCE.length}) ===`);
for (const def of MAINTENANCE) {
  const list = byScraper.get(def.scraperName) ?? [];
  const latest = list[0];
  const active = activeByScraper.get(def.scraperName);
  const hrs = latest ? hoursSince(latest.started_at) : null;
  const status = hrs == null ? 'RED' : hrs > def.expectedCadenceHours * 3 ? 'RED' : hrs > def.expectedCadenceHours * 1.5 ? 'YELLOW' : 'GREEN';
  const activeStr = active ? ` ACTIVE(${ageMin(active.started_at)}m)` : '';
  console.log(`  [${status}] ${def.scraperName.padEnd(28)} last ${hrs ? hrs.toFixed(1) + 'h' : 'never'} ago  runs24h=${list.filter(r=>r.started_at >= oneDayAgo).length}  fail7d=${list.filter(r=>!r.success).length}${activeStr}`);
}

const known = new Set([...SOURCES.flatMap(s => s.scraperNames), ...MAINTENANCE.map(m => m.scraperName)]);
const unknown = actives.data.filter((a) => !known.has(a.scraper_name));
console.log(`\n=== ACTIVE RUNS SNAPSHOT (${actives.data.length}) ===`);
for (const a of actives.data) {
  console.log(`  ${a.scraper_name.padEnd(25)} ${ageMin(a.started_at).toString().padStart(4)}m old  run_id=${a.run_id.slice(0,8)}  ${known.has(a.scraper_name) ? '' : '⚠ UNKNOWN'}`);
}

console.log(`\n=== ALERTS (${allAlerts.length}) ===`);
for (const a of allAlerts) {
  console.log(`  [${a.level}] ${a.scope}:${a.target}  ${a.msg}`);
}
console.log('\ndone.');

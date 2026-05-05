#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { evaluateScraperQualityGate, formatScraperQualityGateResult } from '../src/features/scrapers/common/monitoring/quality.ts';

function parseArgs(argv) {
  const out = {
    scraper: '',
    dryRun: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    if (arg === '--dryRun') {
      out.dryRun = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq === -1) continue;
    const key = arg.slice(2, eq);
    const value = arg.slice(eq + 1);
    if (key === 'scraper') out.scraper = value;
  }

  return out;
}

function getSupabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return { url, key };
}

async function fetchLatestRun(scraperName) {
  const { url, key } = getSupabaseHeaders();
  const endpoint = new URL('/rest/v1/scraper_runs', url);
  endpoint.searchParams.set('select', 'scraper_name,run_id,success,discovered,written,errors_count');
  endpoint.searchParams.set('scraper_name', `eq.${scraperName}`);
  endpoint.searchParams.set('order', 'finished_at.desc');
  endpoint.searchParams.set('limit', '1');

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status}): ${await response.text()}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No scraper_runs row found for ${scraperName}`);
  }

  return rows[0];
}

function fetchLatestRunViaCurl(scraperName) {
  const { url, key } = getSupabaseHeaders();
  const endpoint = new URL('/rest/v1/scraper_runs', url);
  endpoint.searchParams.set('select', 'scraper_name,run_id,success,discovered,written,errors_count');
  endpoint.searchParams.set('scraper_name', `eq.${scraperName}`);
  endpoint.searchParams.set('order', 'finished_at.desc');
  endpoint.searchParams.set('limit', '1');

  const body = execFileSync(
    'curl',
    [
      '-fsS',
      String(endpoint),
      '-H',
      `apikey: ${key}`,
      '-H',
      `Authorization: Bearer ${key}`,
      '-H',
      'Accept: application/json',
    ],
    { encoding: 'utf8' },
  );

  const rows = JSON.parse(body);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No scraper_runs row found for ${scraperName}`);
  }

  return rows[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scraper) {
    console.error('Usage: node scripts/verify-scraper-quality.mjs --scraper=<name> [--dryRun]');
    process.exit(1);
  }

  let run;
  try {
    run = await fetchLatestRun(args.scraper);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('fetch failed')) {
      throw error;
    }
    run = fetchLatestRunViaCurl(args.scraper);
  }
  const result = evaluateScraperQualityGate(run, { dryRun: args.dryRun });
  console.log(formatScraperQualityGateResult(args.scraper, result));
  console.log(JSON.stringify({ scraper: args.scraper, ...result }, null, 2));

  if (!result.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[scraper-quality] Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

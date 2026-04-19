import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createRawClient } from '@supabase/supabase-js';
import {
  SOURCES,
  MAINTENANCE_SCRAPERS,
  getSourceForScraper,
  classifyActiveRun,
  type CanonicalSource,
} from '@/features/scrapers/common/sourceRegistry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_EMAILS = ['caposk8@hotmail.com', 'caposk817@gmail.com'];

type Status = 'green' | 'yellow' | 'red';

interface SourceIngestionRow {
  source: CanonicalSource;
  total_active_listings: number;
  total_listings: number;
  last_listing_inserted_at: string | null;
  last_listing_updated_at: string | null;
  new_24h: number;
  new_7d: number;
  updated_24h: number;
  updated_7d: number;
}

interface ScraperRunRow {
  id: string;
  scraper_name: string;
  run_id: string;
  started_at: string;
  finished_at: string | null;
  success: boolean;
  duration_ms: number | null;
  discovered: number | null;
  written: number | null;
  errors_count: number | null;
  error_messages: string[] | null;
  runtime: string;
}

interface ActiveRunRow {
  scraper_name: string;
  run_id: string;
  started_at: string;
  runtime: string;
  updated_at: string;
}

interface ScraperHealth {
  name: string;
  lastRunAt: string | null;
  lastRunFinishedAt: string | null;
  lastRunSuccess: boolean | null;
  lastRunDurationMs: number | null;
  lastRunDiscovered: number | null;
  lastRunWritten: number | null;
  lastRunErrorsCount: number | null;
  lastRunErrorMessages: string[] | null;
  runs24h: number;
  runs7d: number;
  successes7d: number;
  failures7d: number;
  active: {
    runId: string;
    startedAt: string;
    ageMinutes: number;
    threshold: number;
    state: 'running' | 'stalled' | 'orphaned' | 'unknown';
    note?: string;
  } | null;
  expectedCadenceHours: number;
}

export interface SourceHealth {
  sourceId: CanonicalSource;
  label: string;
  scrapers: ScraperHealth[];
  ingestion: {
    totalActive: number;
    totalAll: number;
    new24h: number;
    new7d: number;
    updated24h: number;
    updated7d: number;
    lastListingAt: string | null;
    lastListingUpdatedAt: string | null;
    hoursSinceLastListing: number | null;
  };
  fieldCompleteness: Record<string, number>;
  status: Status;
  statusReasons: string[];
}

export interface MaintenanceHealth {
  scraperName: string;
  label: string;
  purpose: string;
  expectedCadenceHours: number;
  lastRunAt: string | null;
  lastRunSuccess: boolean | null;
  lastRunDurationMs: number | null;
  lastRunWritten: number | null;
  lastRunErrorsCount: number | null;
  lastRunErrorMessages: string[] | null;
  runs24h: number;
  failures7d: number;
  active: {
    runId: string;
    startedAt: string;
    ageMinutes: number;
    threshold: number;
    state: 'running' | 'stalled' | 'orphaned' | 'unknown';
    note?: string;
  } | null;
  status: Status;
  statusReasons: string[];
}

export interface DataQualityOverviewResponse {
  generatedAt: string;
  sources: SourceHealth[];
  maintenance: MaintenanceHealth[];
  alerts: Array<{
    level: Status;
    scope: 'source' | 'scraper' | 'maintenance';
    target: string;
    message: string;
  }>;
  unknownActiveRuns: Array<{
    scraperName: string;
    runId: string;
    startedAt: string;
    ageMinutes: number;
  }>;
}

const FIELDS = [
  'vin',
  'trim',
  'engine',
  'transmission',
  'mileage',
  'color_exterior',
  'color_interior',
  'body_style',
] as const;

function serviceClient() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  // `listings.created_at` is stored without a timezone — treat as UTC rather
  // than letting JS infer local time.
  const normalized = /([Zz]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : iso + 'Z';
  return (now.getTime() - new Date(normalized).getTime()) / 3_600_000;
}

function statusFromReasons(reasons: { level: Status }[]): Status {
  if (reasons.some((r) => r.level === 'red')) return 'red';
  if (reasons.some((r) => r.level === 'yellow')) return 'yellow';
  return 'green';
}

/**
 * Ingestion-first health: if listings landed recently we trust that signal
 * first. scraper_runs can push to yellow but cannot on its own push a source
 * to red — this is what prevents Elferspot-style false alarms.
 */
function classifySource(params: {
  hoursSinceLastListing: number | null;
  anyScraperFailedRecently: boolean;
  allScrapersSilentDays: number | null;
  anyStalledActiveRun: boolean;
}): { status: Status; reasons: string[] } {
  const reasons: { level: Status; msg: string }[] = [];

  const fresh = params.hoursSinceLastListing != null && params.hoursSinceLastListing < 48;
  const veryStale =
    params.hoursSinceLastListing == null || params.hoursSinceLastListing > 72;

  if (veryStale) {
    reasons.push({
      level: 'red',
      msg:
        params.hoursSinceLastListing == null
          ? 'no listings recorded'
          : `no new listings for ${params.hoursSinceLastListing.toFixed(1)}h`,
    });
  } else if (!fresh) {
    reasons.push({
      level: 'yellow',
      msg: `last listing ${params.hoursSinceLastListing!.toFixed(1)}h ago (>48h)`,
    });
  }

  if (params.anyStalledActiveRun) {
    reasons.push({ level: 'yellow', msg: 'active run exceeded max runtime' });
  }

  if (params.anyScraperFailedRecently) {
    reasons.push({ level: 'yellow', msg: 'recent scraper run failed' });
  }

  if (
    params.allScrapersSilentDays != null &&
    params.allScrapersSilentDays > 2 &&
    !fresh
  ) {
    reasons.push({
      level: 'red',
      msg: `no scraper run in ${params.allScrapersSilentDays}+ days AND no fresh listings`,
    });
  }

  return {
    status: statusFromReasons(reasons),
    reasons: reasons.map((r) => r.msg),
  };
}

function classifyMaintenance(params: {
  lastRunAt: string | null;
  lastRunSuccess: boolean | null;
  expectedCadenceHours: number;
  now: Date;
  anyStalled: boolean;
}): { status: Status; reasons: string[] } {
  const reasons: { level: Status; msg: string }[] = [];
  const hours = hoursSince(params.lastRunAt, params.now);
  if (hours == null) {
    reasons.push({ level: 'red', msg: 'never run' });
  } else if (hours > params.expectedCadenceHours * 3) {
    reasons.push({
      level: 'red',
      msg: `last run ${hours.toFixed(1)}h ago (>3× expected cadence)`,
    });
  } else if (hours > params.expectedCadenceHours * 1.5) {
    reasons.push({
      level: 'yellow',
      msg: `last run ${hours.toFixed(1)}h ago (>1.5× expected cadence)`,
    });
  }
  if (params.lastRunSuccess === false) {
    reasons.push({ level: 'yellow', msg: 'last run failed' });
  }
  if (params.anyStalled) {
    reasons.push({ level: 'yellow', msg: 'active run exceeded max runtime' });
  }
  return { status: statusFromReasons(reasons), reasons: reasons.map((r) => r.msg) };
}

export async function GET() {
  try {
  // --- auth gate ---
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json(
      { status: 401, code: 'AUTH_REQUIRED', message: 'Admin access required' },
      { status: 401 },
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();

  const supa = serviceClient();

  // --- parallel reads against the live DB ---
  const [ingestionRes, runsRes, activeRes, fieldsRes] = await Promise.all([
    supa.from('v_source_ingestion').select('*'),
    supa
      .from('scraper_runs')
      .select(
        'id, scraper_name, run_id, started_at, finished_at, success, duration_ms, discovered, written, errors_count, error_messages, runtime',
      )
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false }),
    supa
      .from('scraper_active_runs')
      .select('scraper_name, run_id, started_at, runtime, updated_at'),
    supa
      .from('listings')
      .select(
        'source, vin, trim, engine, transmission, mileage, color_exterior, color_interior, body_style, images, current_bid, listing_price',
      )
      .eq('status', 'active'),
  ]);

  if (ingestionRes.error) {
    return NextResponse.json(
      { status: 500, code: 'QUERY_ERROR', message: ingestionRes.error.message },
      { status: 500 },
    );
  }

  const ingestion = (ingestionRes.data ?? []) as SourceIngestionRow[];
  const runs = (runsRes.data ?? []) as ScraperRunRow[];
  const actives = (activeRes.data ?? []) as ActiveRunRow[];
  const fieldRows = (fieldsRes.data ?? []) as Record<string, unknown>[];

  const ingestionBySource = new Map(ingestion.map((r) => [r.source, r]));

  // Group runs by scraper_name; order already desc, so first per key is latest.
  const runsByScraper = new Map<string, ScraperRunRow[]>();
  for (const r of runs) {
    const list = runsByScraper.get(r.scraper_name);
    if (list) list.push(r);
    else runsByScraper.set(r.scraper_name, [r]);
  }

  const activeByScraper = new Map<string, ActiveRunRow>();
  for (const a of actives) activeByScraper.set(a.scraper_name, a);

  // Field completeness aggregated in JS (same approach as existing endpoint)
  const fieldAgg: Record<string, { total: number; fields: Record<string, number> }> = {};
  for (const row of fieldRows) {
    const src = (row.source as string) ?? 'unknown';
    const bucket = fieldAgg[src] ?? {
      total: 0,
      fields: Object.fromEntries([...FIELDS, 'price', 'images'].map((f) => [f, 0])),
    };
    bucket.total++;
    for (const f of FIELDS) {
      const v = row[f];
      if (v != null && v !== '') bucket.fields[f]++;
    }
    const price =
      (typeof row.current_bid === 'number' && row.current_bid > 0) ||
      (typeof row.listing_price === 'number' && row.listing_price > 0);
    if (price) bucket.fields.price++;
    if (Array.isArray(row.images) && row.images.length > 0) bucket.fields.images++;
    fieldAgg[src] = bucket;
  }

  const alerts: DataQualityOverviewResponse['alerts'] = [];

  // --- Sources ---
  const sources: SourceHealth[] = SOURCES.map((def) => {
    const ing = ingestionBySource.get(def.id);
    const scrapers: ScraperHealth[] = def.scraperNames.map((name) => {
      const list = runsByScraper.get(name) ?? [];
      const latest = list[0];
      const active = activeByScraper.get(name);
      const runs24h = list.filter((r) => r.started_at >= oneDayAgo).length;
      const successes7d = list.filter((r) => r.success).length;
      const failures7d = list.filter((r) => !r.success).length;
      const classified = active
        ? classifyActiveRun({
            scraperName: name,
            startedAt: active.started_at,
            sourceLastInsertAt: ing?.last_listing_inserted_at ?? null,
            now,
          })
        : null;
      return {
        name,
        lastRunAt: latest?.started_at ?? null,
        lastRunFinishedAt: latest?.finished_at ?? null,
        lastRunSuccess: latest ? latest.success : null,
        lastRunDurationMs: latest?.duration_ms ?? null,
        lastRunDiscovered: latest?.discovered ?? null,
        lastRunWritten: latest?.written ?? null,
        lastRunErrorsCount: latest?.errors_count ?? null,
        lastRunErrorMessages: latest?.error_messages ?? null,
        runs24h,
        runs7d: list.length,
        successes7d,
        failures7d,
        active: active && classified
          ? {
              runId: active.run_id,
              startedAt: active.started_at,
              ageMinutes: classified.ageMinutes,
              threshold: classified.threshold,
              state: classified.state,
              note: classified.note,
            }
          : null,
        expectedCadenceHours: def.expectedCadenceHours,
      };
    });

    const bucket = fieldAgg[def.id];
    const fieldCompleteness: Record<string, number> = {};
    if (bucket && bucket.total > 0) {
      for (const [k, v] of Object.entries(bucket.fields)) {
        fieldCompleteness[k] = Math.round((v / bucket.total) * 1000) / 10;
      }
    }

    const hoursSinceLastListing = hoursSince(ing?.last_listing_inserted_at ?? null, now);
    const anyStalledActiveRun = scrapers.some((s) => s.active?.state === 'stalled');
    const anyOrphanedActiveRun = scrapers.some((s) => s.active?.state === 'orphaned');
    const latestRunTimes = scrapers
      .map((s) => s.lastRunAt)
      .filter((t): t is string => t != null);
    const newestScraperHours = latestRunTimes.length
      ? Math.min(...latestRunTimes.map((t) => hoursSince(t, now) ?? Infinity))
      : null;
    const allScrapersSilentDays =
      newestScraperHours != null ? Math.floor(newestScraperHours / 24) : null;
    const anyScraperFailedRecently = scrapers.some(
      (s) => s.lastRunSuccess === false,
    );

    const { status, reasons } = classifySource({
      hoursSinceLastListing,
      anyScraperFailedRecently,
      allScrapersSilentDays,
      anyStalledActiveRun,
    });
    if (anyOrphanedActiveRun && !reasons.length) {
      reasons.push('active run stuck (recording bug); listings landed OK');
    }

    if (status !== 'green') {
      alerts.push({
        level: status,
        scope: 'source',
        target: def.id,
        message: `${def.label}: ${reasons.join('; ')}`,
      });
    }
    for (const scr of scrapers) {
      if (scr.active?.state === 'stalled') {
        alerts.push({
          level: 'yellow',
          scope: 'scraper',
          target: scr.name,
          message: `${scr.name} active run ${scr.active.ageMinutes}m old (threshold ${scr.active.threshold}m), no listings landed during window`,
        });
      } else if (scr.active?.state === 'orphaned') {
        // Informational — the run did its job but forgot to clean up. Flag for
        // operator awareness without treating the source as unhealthy.
        alerts.push({
          level: 'yellow',
          scope: 'scraper',
          target: scr.name,
          message: `${scr.name} completed its work but never recorded finish (listings landed, active row stuck ${scr.active.ageMinutes}m). Collector bug: missing finally/cleanup.`,
        });
      }
    }

    return {
      sourceId: def.id,
      label: def.label,
      scrapers,
      ingestion: {
        totalActive: ing?.total_active_listings ?? 0,
        totalAll: ing?.total_listings ?? 0,
        new24h: ing?.new_24h ?? 0,
        new7d: ing?.new_7d ?? 0,
        updated24h: ing?.updated_24h ?? 0,
        updated7d: ing?.updated_7d ?? 0,
        lastListingAt: ing?.last_listing_inserted_at ?? null,
        lastListingUpdatedAt: ing?.last_listing_updated_at ?? null,
        hoursSinceLastListing,
      },
      fieldCompleteness,
      status,
      statusReasons: reasons,
    };
  });

  // --- Maintenance scrapers ---
  const maintenance: MaintenanceHealth[] = MAINTENANCE_SCRAPERS.map((def) => {
    const list = runsByScraper.get(def.scraperName) ?? [];
    const latest = list[0];
    const active = activeByScraper.get(def.scraperName);
    const classified = active
      ? classifyActiveRun({ scraperName: def.scraperName, startedAt: active.started_at, now })
      : null;
    const { status, reasons } = classifyMaintenance({
      lastRunAt: latest?.started_at ?? null,
      lastRunSuccess: latest ? latest.success : null,
      expectedCadenceHours: def.expectedCadenceHours,
      now,
      anyStalled: classified?.state === 'stalled',
    });

    if (status !== 'green') {
      alerts.push({
        level: status,
        scope: 'maintenance',
        target: def.scraperName,
        message: `${def.label}: ${reasons.join('; ')}`,
      });
    }

    return {
      scraperName: def.scraperName,
      label: def.label,
      purpose: def.purpose,
      expectedCadenceHours: def.expectedCadenceHours,
      lastRunAt: latest?.started_at ?? null,
      lastRunSuccess: latest ? latest.success : null,
      lastRunDurationMs: latest?.duration_ms ?? null,
      lastRunWritten: latest?.written ?? null,
      lastRunErrorsCount: latest?.errors_count ?? null,
      lastRunErrorMessages: latest?.error_messages ?? null,
      runs24h: list.filter((r) => r.started_at >= oneDayAgo).length,
      failures7d: list.filter((r) => !r.success).length,
      active:
        active && classified
          ? {
              runId: active.run_id,
              startedAt: active.started_at,
              ageMinutes: classified.ageMinutes,
              threshold: classified.threshold,
              state: classified.state,
              note: classified.note,
            }
          : null,
      status,
      statusReasons: reasons,
    };
  });

  // --- Unknown active runs (scrapers not in the registry) ---
  const knownNames = new Set([
    ...SOURCES.flatMap((s) => s.scraperNames),
    ...MAINTENANCE_SCRAPERS.map((m) => m.scraperName),
  ]);
  const unknownActiveRuns = actives
    .filter((a) => !knownNames.has(a.scraper_name))
    .map((a) => {
      const ageMinutes = Math.max(
        0,
        Math.round((now.getTime() - new Date(a.started_at).getTime()) / 60_000),
      );
      return {
        scraperName: a.scraper_name,
        runId: a.run_id,
        startedAt: a.started_at,
        ageMinutes,
      };
    });

  for (const u of unknownActiveRuns) {
    alerts.push({
      level: 'yellow',
      scope: 'scraper',
      target: u.scraperName,
      message: `unknown scraper "${u.scraperName}" has an active run (${u.ageMinutes}m old)`,
    });
  }

  const body: DataQualityOverviewResponse = {
    generatedAt: now.toISOString(),
    sources,
    maintenance,
    alerts,
    unknownActiveRuns,
  };

  return NextResponse.json({ status: 200, code: 'OK', data: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[data-quality/overview] unhandled error:', message, stack);
    return NextResponse.json(
      { status: 500, code: 'INTERNAL_ERROR', message, stack },
      { status: 500 },
    );
  }
}

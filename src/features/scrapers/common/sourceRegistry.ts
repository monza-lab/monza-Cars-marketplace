// Single source of truth mapping canonical `listings.source` values
// (PascalCase, as stored in the DB) to the set of scraper_name values that
// write to them (kebab-case, as emitted by `recordRun()`).
//
// Also lists non-source-specific maintenance scrapers separately so the
// admin dashboard can render them without inventing a fake "source".

import {
  ASSURANCE_SOURCES,
  getScraperNamesForSource,
  getSourceIdsForScraper,
  type AssuranceSourceId,
} from './assurance/manifest';

export interface SourceDefinition {
  /** Canonical value stored in listings.source */
  id: CanonicalSource;
  /** Display label for the UI */
  label: string;
  /** scraper_name values that write listings attributed to this source */
  scraperNames: readonly string[];
  /** Expected cadence in hours — used to flag stale scrapers and stalled active_runs */
  expectedCadenceHours: number;
  /** Max expected runtime in minutes. Active runs older than this are "stalled". */
  maxRunMinutes: number;
}

export interface MaintenanceScraperDefinition {
  scraperName: string;
  label: string;
  expectedCadenceHours: number;
  maxRunMinutes: number;
  /** Short one-line description of what this job does */
  purpose: string;
}

export type CanonicalSource = AssuranceSourceId;

export const SOURCES: readonly SourceDefinition[] = ASSURANCE_SOURCES.map((source) => ({
  id: source.id,
  label: source.label,
  scraperNames: getScraperNamesForSource(source.id),
  expectedCadenceHours: source.expectedCadenceHours,
  maxRunMinutes: source.maxRunMinutes,
}));

export const MAINTENANCE_SCRAPERS: readonly MaintenanceScraperDefinition[] = [
  {
    scraperName: 'backfill-images',
    label: 'Image backfill',
    expectedCadenceHours: 24,
    maxRunMinutes: 45,
    purpose: 'Fetch missing listing photos across all sources',
  },
  {
    scraperName: 'enrich-vin',
    label: 'VIN enrichment',
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    purpose: 'Decode VINs via NHTSA to populate spec fields',
  },
  {
    scraperName: 'enrich-titles',
    label: 'Title enrichment',
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    purpose: 'Extract trim / variant info from listing titles',
  },
  {
    scraperName: 'enrich-details',
    label: 'Detail enrichment',
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    purpose: 'Fill in missing engine / transmission / body style',
  },
  {
    scraperName: 'enrich-details-bulk',
    label: 'Bulk detail enrichment',
    expectedCadenceHours: 168,
    maxRunMinutes: 120,
    purpose: 'Large batch pass over listings missing multiple fields',
  },
  {
    scraperName: 'validate',
    label: 'Listing validation',
    expectedCadenceHours: 24,
    maxRunMinutes: 15,
    purpose: 'Flag rows failing required-field checks',
  },
  {
    scraperName: 'cleanup',
    label: 'Cleanup',
    expectedCadenceHours: 24,
    maxRunMinutes: 10,
    purpose: 'Mark expired active listings as sold / inactive',
  },
  {
    scraperName: 'liveness-check',
    label: 'Liveness check',
    expectedCadenceHours: 24,
    maxRunMinutes: 15,
    purpose: 'Re-check source URLs on active listings',
  },
] as const;

const SOURCE_BY_SCRAPER = new Map<string, readonly CanonicalSource[]>();
for (const source of SOURCES) {
  for (const scraperName of source.scraperNames) {
    SOURCE_BY_SCRAPER.set(
      scraperName,
      Array.from(new Set([...(SOURCE_BY_SCRAPER.get(scraperName) ?? []), source.id])),
    );
  }
}

const MAINTENANCE_BY_SCRAPER = new Map<string, MaintenanceScraperDefinition>(
  MAINTENANCE_SCRAPERS.map((m) => [m.scraperName, m] as const),
);

const SOURCE_BY_ID = new Map<CanonicalSource, SourceDefinition>(
  SOURCES.map((s) => [s.id, s] as const),
);

export function getSourceForScraper(scraperName: string): CanonicalSource | undefined {
  return getSourcesForScraper(scraperName)[0];
}

export function getSourcesForScraper(scraperName: string): readonly CanonicalSource[] {
  return SOURCE_BY_SCRAPER.get(scraperName) ?? getSourceIdsForScraper(scraperName);
}

export function getScrapersForSource(sourceId: CanonicalSource): readonly string[] {
  return SOURCE_BY_ID.get(sourceId)?.scraperNames ?? [];
}

export function getAllSources(): readonly SourceDefinition[] {
  return SOURCES;
}

export function getSourceDefinition(sourceId: CanonicalSource): SourceDefinition | undefined {
  return SOURCE_BY_ID.get(sourceId);
}

export function getMaintenanceScraper(scraperName: string): MaintenanceScraperDefinition | undefined {
  return MAINTENANCE_BY_SCRAPER.get(scraperName);
}

export function getAllMaintenanceScrapers(): readonly MaintenanceScraperDefinition[] {
  return MAINTENANCE_SCRAPERS;
}

/** Every scraper_name the registry knows about (sources + maintenance). */
export function getAllKnownScraperNames(): string[] {
  return [
    ...SOURCES.flatMap((s) => s.scraperNames),
    ...MAINTENANCE_SCRAPERS.map((m) => m.scraperName),
  ];
}

export type ActiveRunState = 'running' | 'stalled' | 'orphaned' | 'unknown';

export interface ClassifyActiveRunArgs {
  scraperName: string;
  startedAt: string;
  /** Most recent listings.created_at for this scraper's source, if any. */
  sourceLastInsertAt?: string | null;
  now?: Date;
}

/**
 * Decide whether an active_runs row is (a) still running, (b) orphaned —
 * i.e. the scraper actually did its work but forgot to clean up the row, or
 * (c) really stalled. The distinction matters: an orphaned row is a
 * recording bug, not a functional failure, and should not scream "broken"
 * at the operator.
 *
 * Heuristic for orphaned: the run is past its maxRunMinutes AND fresh
 * listings landed for the source during the run's expected window
 * [startedAt, startedAt + maxRunMinutes]. If work landed, the run succeeded.
 */
/**
 * Parse a timestamp string, assuming UTC when no TZ offset is present.
 * Supabase returns `listings.created_at` without a timezone because the
 * column is `timestamp` (not `timestamptz`), and JS would otherwise parse
 * those strings as local time.
 */
function parseAsUtc(iso: string): number {
  if (/([Zz]|[+-]\d{2}:?\d{2})$/.test(iso)) return new Date(iso).getTime();
  return new Date(iso + 'Z').getTime();
}

export function classifyActiveRun(
  args: ClassifyActiveRunArgs,
): { state: ActiveRunState; ageMinutes: number; threshold: number; note?: string } {
  const now = args.now ?? new Date();
  const startedAtMs = parseAsUtc(args.startedAt);
  const ageMs = now.getTime() - startedAtMs;
  const ageMinutes = Math.max(0, Math.round(ageMs / 60_000));

  const source = getSourceForScraper(args.scraperName);
  const def = source
    ? SOURCE_BY_ID.get(source)
    : MAINTENANCE_BY_SCRAPER.get(args.scraperName);

  if (!def) return { state: 'unknown', ageMinutes, threshold: 0 };

  const threshold = def.maxRunMinutes * 2;
  if (ageMinutes <= threshold) {
    return { state: 'running', ageMinutes, threshold };
  }

  // Past threshold. Did work actually land?
  if (args.sourceLastInsertAt) {
    const lastMs = parseAsUtc(args.sourceLastInsertAt);
    const windowEnd = startedAtMs + def.maxRunMinutes * 60_000;
    if (lastMs >= startedAtMs && lastMs <= windowEnd) {
      return {
        state: 'orphaned',
        ageMinutes,
        threshold,
        note: 'run completed its writes but never recorded finish',
      };
    }
  }

  return { state: 'stalled', ageMinutes, threshold };
}

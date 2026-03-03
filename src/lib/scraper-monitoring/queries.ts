import { createClient } from '@/lib/supabase/server';
import type { ScraperRun, ScraperName, DailyAggregate, DataQuality } from './types';

/**
 * Fetch the most recent scraper runs, ordered by finished_at DESC.
 */
export async function getRecentRuns(limit: number = 50): Promise<ScraperRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scraper_runs')
    .select('*')
    .order('finished_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[scraper-monitoring] getRecentRuns error:', error.message);
    return [];
  }
  return (data ?? []) as ScraperRun[];
}

/**
 * Fetch daily aggregates via RPC function.
 */
export async function getDailyAggregates(daysBack: number = 30): Promise<DailyAggregate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('scraper_daily_aggregates', {
    days_back: daysBack,
  });

  if (error) {
    console.error('[scraper-monitoring] getDailyAggregates error:', error.message);
    return [];
  }
  return (data ?? []) as DailyAggregate[];
}

/**
 * Fetch data quality metrics via RPC function.
 */
export async function getDataQuality(daysBack: number = 7): Promise<DataQuality[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('source_data_quality', {
    days_back: daysBack,
  });

  if (error) {
    console.error('[scraper-monitoring] getDataQuality error:', error.message);
    return [];
  }
  return (data ?? []) as DataQuality[];
}

/**
 * Fetch the latest run per scraper (most recent successful or failed).
 */
export async function getLatestRunPerScraper(): Promise<Map<ScraperName, ScraperRun>> {
  const supabase = await createClient();

  // Get recent runs and pick the latest per scraper in JS.
  // Limited to 50 rows — enough to cover 6 scrapers even with many runs.
  const { data, error } = await supabase
    .from('scraper_runs')
    .select('*')
    .order('finished_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[scraper-monitoring] getLatestRunPerScraper error:', error.message);
    return new Map();
  }

  const map = new Map<ScraperName, ScraperRun>();
  for (const row of (data ?? []) as ScraperRun[]) {
    if (!map.has(row.scraper_name)) {
      map.set(row.scraper_name, row);
    }
  }
  return map;
}

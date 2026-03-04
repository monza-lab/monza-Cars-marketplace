import { createClient } from '@supabase/supabase-js';
import type { ScraperRunRecord, ScraperName, RuntimeEnv } from './types';

function getMonitoringClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn('[scraper-monitoring] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping monitoring write');
    return null;
  }

  return createClient(url, serviceKey);
}

/**
 * Mark a scraper as actively running.
 */
export async function markScraperRunStarted(params: {
  scraperName: ScraperName;
  runId: string;
  startedAt: string;
  runtime: RuntimeEnv;
}): Promise<void> {
  try {
    const supabase = getMonitoringClient();
    if (!supabase) return;

    const { error } = await supabase.from('scraper_active_runs').upsert(
      {
        scraper_name: params.scraperName,
        run_id: params.runId,
        started_at: params.startedAt,
        runtime: params.runtime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'scraper_name' }
    );

    if (error) {
      console.error('[scraper-monitoring] Failed to mark run started:', error.message);
    }
  } catch (err) {
    console.error('[scraper-monitoring] Unexpected error marking run started:', err instanceof Error ? err.message : err);
  }
}

/**
 * Clear active run marker once run is finished.
 */
export async function clearScraperRunActive(scraperName: ScraperName): Promise<void> {
  try {
    const supabase = getMonitoringClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('scraper_active_runs')
      .delete()
      .eq('scraper_name', scraperName);

    if (error) {
      console.error('[scraper-monitoring] Failed to clear active run:', error.message);
    }
  } catch (err) {
    console.error('[scraper-monitoring] Unexpected error clearing active run:', err instanceof Error ? err.message : err);
  }
}

/**
 * Persist a scraper run record to the scraper_runs table.
 *
 * NON-THROWING: catches all errors internally — monitoring failures
 * must never break collector runs.
 */
export async function recordScraperRun(record: ScraperRunRecord): Promise<void> {
  try {
    const supabase = getMonitoringClient();
    if (!supabase) return;

    const { error } = await supabase.from('scraper_runs').insert({
      scraper_name: record.scraper_name,
      run_id: record.run_id,
      started_at: record.started_at,
      finished_at: record.finished_at,
      success: record.success,
      runtime: record.runtime,
      duration_ms: record.duration_ms,
      discovered: record.discovered,
      written: record.written,
      errors_count: record.errors_count,
      refresh_checked: record.refresh_checked ?? null,
      refresh_updated: record.refresh_updated ?? null,
      details_fetched: record.details_fetched ?? null,
      normalized: record.normalized ?? null,
      skipped_duplicate: record.skipped_duplicate ?? null,
      bot_blocked: record.bot_blocked ?? null,
      backfill_discovered: record.backfill_discovered ?? null,
      backfill_written: record.backfill_written ?? null,
      source_counts: record.source_counts ?? null,
      error_messages: record.error_messages ?? null,
    });

    if (error) {
      console.error('[scraper-monitoring] Failed to record run:', error.message);
    }
  } catch (err) {
    console.error('[scraper-monitoring] Unexpected error recording run:', err instanceof Error ? err.message : err);
  }
}

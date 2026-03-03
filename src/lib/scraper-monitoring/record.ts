import { createClient } from '@supabase/supabase-js';
import type { ScraperRunRecord } from './types';

/**
 * Persist a scraper run record to the scraper_runs table.
 *
 * NON-THROWING: catches all errors internally — monitoring failures
 * must never break collector runs.
 */
export async function recordScraperRun(record: ScraperRunRecord): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      console.warn('[scraper-monitoring] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping run recording');
      return;
    }

    const supabase = createClient(url, serviceKey);

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

export type ScraperName = 'porsche' | 'ferrari' | 'autotrader' | 'beforward' | 'classic' | 'autoscout24' | 'backfill-images';
export type RuntimeEnv = 'vercel_cron' | 'github_actions' | 'cli';

export interface ScraperRunRecord {
  scraper_name: ScraperName;
  run_id: string;
  started_at: string;       // ISO8601
  finished_at: string;
  success: boolean;
  runtime: RuntimeEnv;
  duration_ms: number;
  discovered: number;
  written: number;
  errors_count: number;
  refresh_checked?: number;
  refresh_updated?: number;
  details_fetched?: number;
  normalized?: number;
  skipped_duplicate?: number;
  bot_blocked?: number;
  backfill_discovered?: number;
  backfill_written?: number;
  source_counts?: Record<string, { discovered: number; written: number }>;
  error_messages?: string[];
}

/** Row returned from the scraper_runs table */
export interface ScraperRun extends ScraperRunRecord {
  id: string;
}

/** Row returned from the scraper_active_runs table */
export interface ActiveScraperRun {
  scraper_name: ScraperName;
  run_id: string;
  started_at: string;
  runtime: RuntimeEnv;
  updated_at: string;
}

/** Row returned by scraper_daily_aggregates() RPC */
export interface DailyAggregate {
  scraper_name: string;
  run_date: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  total_discovered: number;
  total_written: number;
  total_errors: number;
  avg_duration_ms: number;
  total_bot_blocked: number;
}

/** Row returned by source_data_quality() RPC */
export interface DataQuality {
  source: string;
  avg_quality: number | null;
  total_listings: number;
  listings_with_images: number;
  listings_with_price: number;
}

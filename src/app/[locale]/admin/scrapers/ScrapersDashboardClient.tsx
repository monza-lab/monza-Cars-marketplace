"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type {
  ScraperRun,
  ScraperName,
  DailyAggregate,
  DataQuality,
  ActiveScraperRun,
} from "@/features/scrapers/common/monitoring";
import {
  getScraperHealthLabel,
  getScraperHealthState,
} from "@/features/scrapers/common/monitoring";

const ALL_SCRAPERS: ScraperName[] = [
  "porsche",
  "ferrari",
  "autotrader",
  "beforward",
  "classic",
  "autoscout24",
  "elferspot",
  "backfill-images",
  "enrich-vin",
  "enrich-titles",
  "enrich-details",
  "enrich-autotrader",
  "enrich-beforward",
  "enrich-elferspot",
  "backfill-photos-elferspot",
  "enrich-details-bulk",
  "bat-detail",
  "validate",
  "cleanup",
  "liveness-check",
];

const SCRAPER_LABELS: Record<ScraperName, string> = {
  porsche: "Porsche",
  ferrari: "Ferrari",
  autotrader: "AutoTrader",
  beforward: "BeForward",
  classic: "Classic.com",
  autoscout24: "AutoScout24",
  elferspot: "Elferspot",
  "backfill-images": "Image Backfill",
  "enrich-vin": "VIN Enrichment",
  "enrich-titles": "Title Enrichment",
  "enrich-details": "AS24 Detail Enrichment",
  "enrich-autotrader": "AutoTrader Enrichment",
  "enrich-beforward": "BeForward Enrichment",
  "enrich-elferspot": "Elferspot Enrichment",
  "backfill-photos-elferspot": "Elferspot Photo Backfill",
  "enrich-details-bulk": "AS24 Bulk Enrichment",
  "bat-detail": "BaT Detail",
  validate: "Validator",
  cleanup: "Cleanup",
  "liveness-check": "Liveness Checker",
};

const SCRAPER_RUNTIME: Record<ScraperName, string> = {
  porsche: "Vercel Cron",
  ferrari: "Vercel Cron",
  autotrader: "Vercel Cron",
  beforward: "Vercel Cron",
  classic: "GitHub Actions",
  autoscout24: "GitHub Actions",
  elferspot: "Vercel Cron",
  "backfill-images": "Vercel Cron",
  "enrich-vin": "Vercel Cron",
  "enrich-titles": "Vercel Cron",
  "enrich-details": "Vercel Cron",
  "enrich-autotrader": "Vercel Cron",
  "enrich-beforward": "Vercel Cron",
  "enrich-elferspot": "Vercel Cron",
  "backfill-photos-elferspot": "Vercel Cron",
  "enrich-details-bulk": "GitHub Actions",
  "bat-detail": "GitHub Actions",
  validate: "Vercel Cron",
  cleanup: "Vercel Cron",
  "liveness-check": "GitHub Actions",
};

const SCRAPER_CADENCE_MS: Record<ScraperName, number> = {
  porsche: 24 * 60 * 60 * 1000,
  ferrari: 24 * 60 * 60 * 1000,
  autotrader: 24 * 60 * 60 * 1000,
  beforward: 24 * 60 * 60 * 1000,
  classic: 24 * 60 * 60 * 1000,
  autoscout24: 24 * 60 * 60 * 1000,
  elferspot: 24 * 60 * 60 * 1000,
  "backfill-images": 24 * 60 * 60 * 1000,
  "enrich-vin": 24 * 60 * 60 * 1000,
  "enrich-titles": 24 * 60 * 60 * 1000,
  "enrich-details": 24 * 60 * 60 * 1000,
  "enrich-autotrader": 24 * 60 * 60 * 1000,
  "enrich-beforward": 24 * 60 * 60 * 1000,
  "enrich-elferspot": 24 * 60 * 60 * 1000,
  "backfill-photos-elferspot": 24 * 60 * 60 * 1000,
  "enrich-details-bulk": 24 * 60 * 60 * 1000,
  "bat-detail": 24 * 60 * 60 * 1000,
  validate: 24 * 60 * 60 * 1000,
  cleanup: 24 * 60 * 60 * 1000,
  "liveness-check": 24 * 60 * 60 * 1000,
};

const POLL_INTERVAL_MS = 20_000;
const STALE_MULTIPLIER = 1.5;
const RUNNING_STALLED_AFTER_MS = 20 * 60 * 1000;

type CardStatus =
  | "running"
  | "healthy"
  | "degraded"
  | "zero-output-success"
  | "failed";

type LivePayload = {
  recentRuns: ScraperRun[];
  dailyAggregates: DailyAggregate[];
  dataQuality: DataQuality[];
  latestRuns: Record<string, ScraperRun>;
  activeRuns: Record<string, ActiveScraperRun>;
  generatedAt: string;
};

interface Props {
  recentRuns: ScraperRun[];
  dailyAggregates: DailyAggregate[];
  dataQuality: DataQuality[];
  latestRuns: Record<string, ScraperRun>;
  activeRuns: Record<string, ActiveScraperRun>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function isRunStale(scraperName: ScraperName, finishedAt: string): boolean {
  const cadence = SCRAPER_CADENCE_MS[scraperName] ?? 24 * 60 * 60 * 1000;
  return Date.now() - new Date(finishedAt).getTime() > cadence * STALE_MULTIPLIER;
}

function isActiveRunStalled(activeRun: ActiveScraperRun): boolean {
  return Date.now() - new Date(activeRun.started_at).getTime() > RUNNING_STALLED_AFTER_MS;
}

function getStatusColor(
  scraperName: ScraperName,
  run: ScraperRun | undefined,
  activeRun: ActiveScraperRun | undefined
): CardStatus {
  return getScraperHealthState(
    run,
    activeRun,
    SCRAPER_CADENCE_MS[scraperName]
  );
}

const STATUS_STYLES = {
  running: "border-sky-500/40 bg-sky-500/10",
  healthy: "border-emerald-500/30 bg-emerald-500/5",
  "zero-output-success": "border-amber-500/30 bg-amber-500/5",
  degraded: "border-orange-500/30 bg-orange-500/5",
  failed: "border-red-500/30 bg-red-500/5",
};

const STATUS_DOT = {
  running: "bg-sky-400 animate-pulse",
  healthy: "bg-emerald-500",
  "zero-output-success": "bg-amber-400",
  degraded: "bg-orange-400",
  failed: "bg-red-500",
};

interface FieldCompletenessRow {
  source: string;
  total: number;
  vin: number;
  trim: number;
  engine: number;
  transmission: number;
  mileage_km: number;
  color_exterior: number;
  color_interior: number;
  body_style: number;
  price: number;
  images: number;
}

export default function ScrapersDashboardClient({
  recentRuns,
  dailyAggregates,
  dataQuality,
  latestRuns,
  activeRuns,
}: Props) {
  const [fieldCompleteness, setFieldCompleteness] = useState<FieldCompletenessRow[] | null>(null);
  const [scraperFilter, setScraperFilter] = useState<string>("all");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [liveRecentRuns, setLiveRecentRuns] = useState<ScraperRun[]>(recentRuns);
  const [liveDailyAggregates, setLiveDailyAggregates] =
    useState<DailyAggregate[]>(dailyAggregates);
  const [liveDataQuality, setLiveDataQuality] = useState<DataQuality[]>(dataQuality);
  const [liveLatestRuns, setLiveLatestRuns] =
    useState<Record<string, ScraperRun>>(latestRuns);
  const [liveActiveRuns, setLiveActiveRuns] =
    useState<Record<string, ActiveScraperRun>>(activeRuns);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const filteredRuns =
    scraperFilter === "all"
      ? liveRecentRuns
      : liveRecentRuns.filter((r) => r.scraper_name === scraperFilter);

  const issueCount = useMemo(() => {
    return ALL_SCRAPERS.reduce((count, scraperName) => {
      const run = liveLatestRuns[scraperName];
      const activeRun = liveActiveRuns[scraperName];
      const state = getScraperHealthState(
        run,
        activeRun,
        SCRAPER_CADENCE_MS[scraperName]
      );
      return state === "healthy" || state === "running" ? count : count + 1;
    }, 0);
  }, [liveActiveRuns, liveLatestRuns]);

  useEffect(() => {
    isMountedRef.current = true;

    const applyPayload = (payload: LivePayload) => {
      setLiveRecentRuns(payload.recentRuns);
      setLiveDailyAggregates(payload.dailyAggregates);
      setLiveDataQuality(payload.dataQuality);
      setLiveLatestRuns(payload.latestRuns);
      setLiveActiveRuns(payload.activeRuns ?? {});
      setLastUpdatedAt(payload.generatedAt || new Date().toISOString());
      setLiveError(null);
    };

    const refresh = async () => {
      try {
        if (isMountedRef.current) setIsRefreshing(true);
        const response = await fetch("/api/admin/scrapers/live", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Live refresh failed (${response.status})`);
        }

        const json = await response.json();
        const payload = json?.data as LivePayload | undefined;

        if (!payload) {
          throw new Error("Live refresh returned empty payload");
        }

        if (isMountedRef.current) {
          applyPayload(payload);
        }
      } catch (error) {
        if (isMountedRef.current) {
          const message =
            error instanceof Error
              ? error.message
              : "Live updates unavailable, showing last known data";
          setLiveError(message);
        }
      } finally {
        if (isMountedRef.current) setIsRefreshing(false);
      }
    };

    void refresh();
    // Fetch field completeness data
    fetch("/api/admin/scrapers/field-completeness")
      .then((r) => r.json())
      .then((d) => { if (d.data && isMountedRef.current) setFieldCompleteness(d.data); })
      .catch(console.error);
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);

    let removeChannel: (() => void) | null = null;
    try {
      const supabase = createSupabaseClient();
      const channel = supabase
        .channel("admin-scrapers-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "scraper_runs" },
          () => {
            void refresh();
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "scraper_active_runs" },
          () => {
            void refresh();
          }
        )
        .subscribe();

      removeChannel = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Polling remains active even if realtime setup fails.
    }

    return () => {
      isMountedRef.current = false;
      window.clearInterval(interval);
      if (removeChannel) removeChannel();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Scraper Monitoring
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Ops console — run history, per-scraper detail, raw diagnostics.
              </p>
            </div>
            <a
              href="./data-quality"
              className="px-3 py-1.5 rounded border border-border bg-muted/50 text-xs text-foreground hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-500/50 transition-colors whitespace-nowrap"
              title="Source-centric, ingestion-truth view"
            >
              Data Quality →
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>7 collectors &middot; 5 Vercel Cron + 2 GitHub Actions</p>
            <span className="text-muted-foreground/50">|</span>
            <p>
              Last updated <span className="text-foreground">{formatTimeAgo(lastUpdatedAt)}</span>
            </p>
            <Badge variant={isRefreshing ? "secondary" : "outline"} className="text-[11px]">
              {isRefreshing ? "Refreshing" : "Live"}
            </Badge>
            {issueCount > 0 && (
              <Badge variant="destructive" className="text-[11px]">
                {issueCount} issues
              </Badge>
            )}
            {liveError && <span className="text-amber-600 dark:text-amber-400 text-xs">{liveError}</span>}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted border border-border">
            <TabsTrigger value="overview">Status</TabsTrigger>
            <TabsTrigger value="history">Run History</TabsTrigger>
            <TabsTrigger value="trends">Daily Trends</TabsTrigger>
            <TabsTrigger value="quality">Data Quality</TabsTrigger>
          </TabsList>

          {/* ── Section 1: Status Overview ── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALL_SCRAPERS.map((name) => {
                const run = liveLatestRuns[name];
                const activeRun = liveActiveRuns[name];
                const status = getStatusColor(name, run, activeRun);
                const stale = run ? isRunStale(name, run.finished_at) : false;
                const stalled = activeRun ? isActiveRunStalled(activeRun) : false;
                return (
                  <Card
                    key={name}
                    className={`bg-card border ${STATUS_STYLES[status]}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium text-foreground">
                          {SCRAPER_LABELS[name]}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`}
                          />
                          <Badge
                            variant={
                              status === "running"
                                ? "secondary"
                                : status === "healthy"
                                  ? "default"
                                  : status === "zero-output-success"
                                    ? "secondary"
                                    : status === "degraded"
                                      ? "outline"
                                  : "destructive"
                            }
                            className="text-xs"
                          >
                            {status === "running"
                              ? stalled
                                ? "RUN STALLED"
                                : "RUNNING"
                              : getScraperHealthLabel(status)}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/60">
                        {SCRAPER_RUNTIME[name]}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {run ? (
                        <div className="space-y-2 text-sm">
                          {activeRun && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Live run</span>
                              <span className={stalled ? "text-red-600 dark:text-red-400" : "text-sky-700 dark:text-sky-300"}>
                                {stalled
                                  ? `Stalled (${formatTimeAgo(activeRun.started_at)})`
                                  : `Running (${formatTimeAgo(activeRun.started_at)})`}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-muted-foreground">
                            <span>Last run</span>
                            <span className="text-foreground">
                              {formatTimeAgo(run.finished_at)}
                            </span>
                          </div>
                          {stale && (
                            <div className="text-amber-700 dark:text-amber-300 text-xs">
                              Expected cadence missed ({Math.round(SCRAPER_CADENCE_MS[name] / (60 * 60 * 1000))}h)
                            </div>
                          )}
                          <div className="flex justify-between text-muted-foreground">
                            <span>Duration</span>
                            <span className="text-foreground">
                              {formatDuration(run.duration_ms)}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Discovered</span>
                            <span className="text-foreground">
                              {run.discovered}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Written</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              {run.written}
                            </span>
                          </div>
                          {run.errors_count > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Errors</span>
                              <span className="text-red-600 dark:text-red-400">
                                {run.errors_count}
                              </span>
                            </div>
                          )}
                          {run.error_messages && run.error_messages.length > 0 && (
                            <p className="text-red-700/90 dark:text-red-300/90 text-xs truncate" title={run.error_messages[0]}>
                              {run.error_messages[0]}
                            </p>
                          )}
                          {run.bot_blocked != null && run.bot_blocked > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Bot blocked</span>
                              <span className="text-amber-600 dark:text-amber-400">
                                {run.bot_blocked}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground/60">
                          No runs recorded yet
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ── Section 2: Run History ── */}
          <TabsContent value="history">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-foreground">
                    Recent Runs
                  </CardTitle>
                  <Select
                    value={scraperFilter}
                    onValueChange={setScraperFilter}
                  >
                    <SelectTrigger className="w-[180px] bg-muted border-border text-foreground">
                      <SelectValue placeholder="All scrapers" />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      <SelectItem value="all">All scrapers</SelectItem>
                      {ALL_SCRAPERS.map((name) => (
                        <SelectItem key={name} value={name}>
                          {SCRAPER_LABELS[name]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60 py-8 text-center">
                    No runs found
                  </p>
                ) : (
                  <div className="space-y-0">
                    {/* Table header */}
                    <div className="grid grid-cols-[120px_80px_100px_70px_80px_80px_60px_60px] gap-2 px-3 py-2 text-xs text-muted-foreground border-b border-border font-medium">
                      <span>Scraper</span>
                      <span>Status</span>
                      <span>Time</span>
                      <span>Duration</span>
                      <span className="text-right">Discovered</span>
                      <span className="text-right">Written</span>
                      <span className="text-right">Errors</span>
                      <span></span>
                    </div>
                    {/* Rows */}
                    {filteredRuns.map((run) => (
                      <div key={run.id}>
                        {(() => {
                          const runState = getScraperHealthState(
                            run,
                            undefined,
                            SCRAPER_CADENCE_MS[run.scraper_name]
                          );

                          return (
                        <div
                          className="grid grid-cols-[120px_80px_100px_70px_80px_80px_60px_60px] gap-2 px-3 py-2.5 text-sm border-b border-border/60 hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            setExpandedRunId(
                              expandedRunId === run.id ? null : run.id
                            )
                          }
                        >
                          <span className="text-foreground truncate">
                            {SCRAPER_LABELS[run.scraper_name]}
                          </span>
                          <span>
                            <Badge
                              variant={
                                runState === "healthy"
                                  ? "default"
                                  : runState === "zero-output-success"
                                      ? "secondary"
                                      : runState === "degraded"
                                          ? "outline"
                                          : "destructive"
                              }
                              className="text-xs"
                            >
                              {getScraperHealthLabel(runState)}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatTimeAgo(run.finished_at)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatDuration(run.duration_ms)}
                          </span>
                          <span className="text-right text-foreground">
                            {run.discovered}
                          </span>
                          <span className="text-right text-emerald-600 dark:text-emerald-400">
                            {run.written}
                          </span>
                          <span
                            className={`text-right ${run.errors_count > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground/60"}`}
                          >
                            {run.errors_count}
                          </span>
                          <span className="text-right text-muted-foreground/60 text-xs">
                            {expandedRunId === run.id ? "▲" : "▼"}
                          </span>
                        </div>
                          );
                        })()}

                        {/* Expanded detail */}
                        {expandedRunId === run.id && (
                          <div className="px-3 py-3 bg-muted/30 border-b border-border/60 text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground max-w-md">
                              <span>Run ID</span>
                              <span className="text-foreground tabular-nums truncate">
                                {run.run_id}
                              </span>
                              <span>Runtime</span>
                              <span className="text-foreground">
                                {run.runtime}
                              </span>
                              <span>Started</span>
                              <span className="text-foreground">
                                {new Date(run.started_at).toLocaleString()}
                              </span>
                              <span>Finished</span>
                              <span className="text-foreground">
                                {new Date(run.finished_at).toLocaleString()}
                              </span>
                              {run.refresh_checked != null && (
                                <>
                                  <span>Refresh checked</span>
                                  <span className="text-foreground">
                                    {run.refresh_checked}
                                  </span>
                                </>
                              )}
                              {run.refresh_updated != null && (
                                <>
                                  <span>Refresh updated</span>
                                  <span className="text-foreground">
                                    {run.refresh_updated}
                                  </span>
                                </>
                              )}
                              {run.details_fetched != null && (
                                <>
                                  <span>Details fetched</span>
                                  <span className="text-foreground">
                                    {run.details_fetched}
                                  </span>
                                </>
                              )}
                              {run.normalized != null && (
                                <>
                                  <span>Normalized</span>
                                  <span className="text-foreground">
                                    {run.normalized}
                                  </span>
                                </>
                              )}
                              {run.skipped_duplicate != null &&
                                run.skipped_duplicate > 0 && (
                                  <>
                                    <span>Skipped duplicate</span>
                                    <span className="text-foreground">
                                      {run.skipped_duplicate}
                                    </span>
                                  </>
                                )}
                              {run.bot_blocked != null &&
                                run.bot_blocked > 0 && (
                                  <>
                                    <span>Bot blocked</span>
                                    <span className="text-amber-600 dark:text-amber-400">
                                      {run.bot_blocked}
                                    </span>
                                  </>
                                )}
                              {run.backfill_discovered != null && (
                                <>
                                  <span>Backfill discovered</span>
                                  <span className="text-foreground">
                                    {run.backfill_discovered}
                                  </span>
                                </>
                              )}
                              {run.backfill_written != null && (
                                <>
                                  <span>Backfill written</span>
                                  <span className="text-foreground">
                                    {run.backfill_written}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Source counts */}
                            {run.source_counts &&
                              Object.keys(run.source_counts).length > 0 && (
                                <div className="mt-2">
                                  <p className="text-muted-foreground mb-1 font-medium">
                                    Source breakdown
                                  </p>
                                  <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 max-w-sm">
                                    <span className="text-muted-foreground/60">
                                      Source
                                    </span>
                                    <span className="text-muted-foreground/60 text-right">
                                      Disc.
                                    </span>
                                    <span className="text-muted-foreground/60 text-right">
                                      Written
                                    </span>
                                    {Object.entries(
                                      run.source_counts as Record<
                                        string,
                                        { discovered: number; written: number }
                                      >
                                    ).map(([src, c]) => (
                                      <div
                                        key={src}
                                        className="contents"
                                      >
                                        <span className="text-foreground">
                                          {src}
                                        </span>
                                        <span className="text-muted-foreground text-right">
                                          {c.discovered}
                                        </span>
                                        <span className="text-emerald-600 dark:text-emerald-400 text-right">
                                          {c.written}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Error messages */}
                            {run.error_messages &&
                              run.error_messages.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-red-600 dark:text-red-400 mb-1 font-medium">
                                    Errors
                                  </p>
                                  <div className="space-y-0.5">
                                    {run.error_messages.map((msg, i) => (
                                      <p
                                        key={i}
                                        className="text-red-700/80 dark:text-red-300/80 tabular-nums text-[11px] truncate"
                                      >
                                        {msg}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Section 3: Daily Trends ── */}
          <TabsContent value="trends">
            <DailyTrendsSection aggregates={liveDailyAggregates} />
          </TabsContent>

          {/* ── Section 4: Data Quality ── */}
          <TabsContent value="quality">
            <DataQualitySection data={liveDataQuality} />
            {fieldCompleteness && (
              <Card className="bg-card border-border mt-6">
                <CardHeader>
                  <CardTitle className="text-foreground">Field Completeness by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 text-muted-foreground">Source</th>
                          <th className="p-2 text-muted-foreground">Total</th>
                          {["VIN","Trim","Engine","Trans.","Mileage","Ext. Color","Int. Color","Body","Price","Images"].map(h => (
                            <th key={h} className="p-2 text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fieldCompleteness.map((row) => (
                          <tr key={row.source} className="border-b border-border/60">
                            <td className="p-2 font-medium text-foreground">{row.source}</td>
                            <td className="p-2 text-center text-foreground">{row.total.toLocaleString()}</td>
                            {[row.vin, row.trim, row.engine, row.transmission, row.mileage_km,
                              row.color_exterior, row.color_interior, row.body_style, row.price, row.images
                            ].map((pct, i) => (
                              <td key={i} className={`p-2 text-center tabular-nums text-xs ${
                                pct >= 90 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                                pct >= 50 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                                "bg-red-500/10 text-red-700 dark:text-red-400"
                              }`}>
                                {pct}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Daily Trends sub-component                                     */
/* ─────────────────────────────────────────────────────────────── */

function DailyTrendsSection({
  aggregates,
}: {
  aggregates: DailyAggregate[];
}) {
  const [selectedScraper, setSelectedScraper] = useState<string>("all");

  // Group by date
  const dateMap = new Map<string, DailyAggregate[]>();
  for (const agg of aggregates) {
    const existing = dateMap.get(agg.run_date) ?? [];
    existing.push(agg);
    dateMap.set(agg.run_date, existing);
  }

  const filtered =
    selectedScraper === "all"
      ? aggregates
      : aggregates.filter((a) => a.scraper_name === selectedScraper);

  // Group filtered by date
  const filteredDateMap = new Map<string, DailyAggregate[]>();
  for (const agg of filtered) {
    const existing = filteredDateMap.get(agg.run_date) ?? [];
    existing.push(agg);
    filteredDateMap.set(agg.run_date, existing);
  }

  const filteredDates = Array.from(filteredDateMap.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-foreground">
            Daily Trends (30 days)
          </CardTitle>
          <Select value={selectedScraper} onValueChange={setSelectedScraper}>
            <SelectTrigger className="w-[180px] bg-muted border-border text-foreground">
              <SelectValue placeholder="All scrapers" />
            </SelectTrigger>
            <SelectContent className="bg-muted border-border">
              <SelectItem value="all">All scrapers</SelectItem>
              {ALL_SCRAPERS.map((name) => (
                <SelectItem key={name} value={name}>
                  {SCRAPER_LABELS[name]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filteredDates.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 py-8 text-center">
            No aggregate data available
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-[100px_100px_60px_60px_60px_80px_80px_60px_80px] gap-2 px-3 py-2 text-xs text-muted-foreground border-b border-border font-medium">
              <span>Date</span>
              <span>Scraper</span>
              <span className="text-right">Runs</span>
              <span className="text-right">OK</span>
              <span className="text-right">Fail</span>
              <span className="text-right">Discovered</span>
              <span className="text-right">Written</span>
              <span className="text-right">Errors</span>
              <span className="text-right">Avg Dur.</span>
            </div>
            {filteredDates.map((date) =>
              (filteredDateMap.get(date) ?? []).map((agg) => (
                <div
                  key={`${date}-${agg.scraper_name}`}
                  className="grid grid-cols-[100px_100px_60px_60px_60px_80px_80px_60px_80px] gap-2 px-3 py-2 text-sm border-b border-border/60 hover:bg-muted/50"
                >
                  <span className="text-muted-foreground text-xs">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-foreground text-xs">
                    {SCRAPER_LABELS[agg.scraper_name as ScraperName] ??
                      agg.scraper_name}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {agg.total_runs}
                  </span>
                  <span className="text-right text-emerald-600 dark:text-emerald-400">
                    {agg.successful_runs}
                  </span>
                  <span
                    className={`text-right ${agg.failed_runs > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground/60"}`}
                  >
                    {agg.failed_runs}
                  </span>
                  <span className="text-right text-foreground">
                    {agg.total_discovered}
                  </span>
                  <span className="text-right text-emerald-600 dark:text-emerald-400">
                    {agg.total_written}
                  </span>
                  <span
                    className={`text-right ${agg.total_errors > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/60"}`}
                  >
                    {agg.total_errors}
                  </span>
                  <span className="text-right text-muted-foreground text-xs">
                    {formatDuration(Math.round(agg.avg_duration_ms))}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Data Quality sub-component                                     */
/* ─────────────────────────────────────────────────────────────── */

function DataQualitySection({ data }: { data: DataQuality[] }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base text-foreground">
          Data Quality (last 7 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 py-8 text-center">
            No quality data available
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-[140px_100px_100px_100px_100px] gap-2 px-3 py-2 text-xs text-muted-foreground border-b border-border font-medium">
              <span>Source</span>
              <span className="text-right">Avg Quality</span>
              <span className="text-right">Listings</span>
              <span className="text-right">With Images</span>
              <span className="text-right">With Price</span>
            </div>
            {data.map((row) => {
              const imgPct =
                row.total_listings > 0
                  ? Math.round(
                      (row.listings_with_images / row.total_listings) * 100
                    )
                  : 0;
              const pricePct =
                row.total_listings > 0
                  ? Math.round(
                      (row.listings_with_price / row.total_listings) * 100
                    )
                  : 0;

              return (
                <div
                  key={row.source}
                  className="grid grid-cols-[140px_100px_100px_100px_100px] gap-2 px-3 py-2.5 text-sm border-b border-border/60 hover:bg-muted/50"
                >
                  <span className="text-foreground">{row.source}</span>
                  <span className="text-right">
                    {row.avg_quality != null ? (
                      <span
                        className={
                          row.avg_quality >= 70
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.avg_quality >= 40
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                        }
                      >
                        {row.avg_quality.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {row.total_listings}
                  </span>
                  <span className="text-right">
                    <span
                      className={
                        imgPct >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : imgPct >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }
                    >
                      {imgPct}%
                    </span>
                    <span className="text-muted-foreground/60 ml-1 text-xs">
                      ({row.listings_with_images})
                    </span>
                  </span>
                  <span className="text-right">
                    <span
                      className={
                        pricePct >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : pricePct >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }
                    >
                      {pricePct}%
                    </span>
                    <span className="text-muted-foreground/60 ml-1 text-xs">
                      ({row.listings_with_price})
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

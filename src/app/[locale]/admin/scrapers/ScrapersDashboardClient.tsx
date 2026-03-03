"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import type {
  ScraperRun,
  ScraperName,
  DailyAggregate,
  DataQuality,
} from "@/lib/scraper-monitoring";

const ALL_SCRAPERS: ScraperName[] = [
  "porsche",
  "ferrari",
  "autotrader",
  "beforward",
  "classic",
  "autoscout24",
];

const SCRAPER_LABELS: Record<ScraperName, string> = {
  porsche: "Porsche",
  ferrari: "Ferrari",
  autotrader: "AutoTrader",
  beforward: "BeForward",
  classic: "Classic.com",
  autoscout24: "AutoScout24",
};

const SCRAPER_RUNTIME: Record<ScraperName, string> = {
  porsche: "Vercel Cron",
  ferrari: "Vercel Cron",
  autotrader: "Vercel Cron",
  beforward: "Vercel Cron",
  classic: "GitHub Actions",
  autoscout24: "GitHub Actions",
};

interface Props {
  recentRuns: ScraperRun[];
  dailyAggregates: DailyAggregate[];
  dataQuality: DataQuality[];
  latestRuns: Record<string, ScraperRun>;
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

function getStatusColor(
  run: ScraperRun | undefined
): "green" | "yellow" | "red" {
  if (!run) return "red";
  if (!run.success) return "red";
  const hoursAgo =
    (Date.now() - new Date(run.finished_at).getTime()) / (1000 * 60 * 60);
  if (hoursAgo <= 26) return "green";
  if (hoursAgo <= 48) return "yellow";
  return "red";
}

const STATUS_STYLES = {
  green: "border-emerald-500/30 bg-emerald-500/5",
  yellow: "border-amber-500/30 bg-amber-500/5",
  red: "border-red-500/30 bg-red-500/5",
};

const STATUS_DOT = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

export default function ScrapersDashboardClient({
  recentRuns,
  dailyAggregates,
  dataQuality,
  latestRuns,
}: Props) {
  const [scraperFilter, setScraperFilter] = useState<string>("all");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const filteredRuns =
    scraperFilter === "all"
      ? recentRuns
      : recentRuns.filter((r) => r.scraper_name === scraperFilter);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Scraper Monitoring
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            6 collectors &middot; 4 Vercel Cron + 2 GitHub Actions
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview">Status</TabsTrigger>
            <TabsTrigger value="history">Run History</TabsTrigger>
            <TabsTrigger value="trends">Daily Trends</TabsTrigger>
            <TabsTrigger value="quality">Data Quality</TabsTrigger>
          </TabsList>

          {/* ── Section 1: Status Overview ── */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALL_SCRAPERS.map((name) => {
                const run = latestRuns[name];
                const status = getStatusColor(run);
                return (
                  <Card
                    key={name}
                    className={`bg-zinc-950 border ${STATUS_STYLES[status]}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium text-zinc-200">
                          {SCRAPER_LABELS[name]}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`}
                          />
                          <Badge
                            variant={
                              run?.success ? "default" : "destructive"
                            }
                            className="text-xs"
                          >
                            {run ? (run.success ? "OK" : "FAIL") : "NO DATA"}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-600">
                        {SCRAPER_RUNTIME[name]}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {run ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-zinc-400">
                            <span>Last run</span>
                            <span className="text-zinc-300">
                              {formatTimeAgo(run.finished_at)}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Duration</span>
                            <span className="text-zinc-300">
                              {formatDuration(run.duration_ms)}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Discovered</span>
                            <span className="text-zinc-300">
                              {run.discovered}
                            </span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Written</span>
                            <span className="text-emerald-400 font-medium">
                              {run.written}
                            </span>
                          </div>
                          {run.errors_count > 0 && (
                            <div className="flex justify-between text-zinc-400">
                              <span>Errors</span>
                              <span className="text-red-400">
                                {run.errors_count}
                              </span>
                            </div>
                          )}
                          {run.bot_blocked != null && run.bot_blocked > 0 && (
                            <div className="flex justify-between text-zinc-400">
                              <span>Bot blocked</span>
                              <span className="text-amber-400">
                                {run.bot_blocked}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-600">
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
            <Card className="bg-zinc-950 border-zinc-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-zinc-200">
                    Recent Runs
                  </CardTitle>
                  <Select
                    value={scraperFilter}
                    onValueChange={setScraperFilter}
                  >
                    <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-700 text-zinc-300">
                      <SelectValue placeholder="All scrapers" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
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
                  <p className="text-sm text-zinc-600 py-8 text-center">
                    No runs found
                  </p>
                ) : (
                  <div className="space-y-0">
                    {/* Table header */}
                    <div className="grid grid-cols-[120px_80px_100px_70px_80px_80px_60px_60px] gap-2 px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 font-medium">
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
                        <div
                          className="grid grid-cols-[120px_80px_100px_70px_80px_80px_60px_60px] gap-2 px-3 py-2.5 text-sm border-b border-zinc-800/50 hover:bg-zinc-900/50 cursor-pointer"
                          onClick={() =>
                            setExpandedRunId(
                              expandedRunId === run.id ? null : run.id
                            )
                          }
                        >
                          <span className="text-zinc-300 truncate">
                            {SCRAPER_LABELS[run.scraper_name]}
                          </span>
                          <span>
                            <Badge
                              variant={
                                run.success ? "default" : "destructive"
                              }
                              className="text-xs"
                            >
                              {run.success ? "OK" : "FAIL"}
                            </Badge>
                          </span>
                          <span className="text-zinc-500 text-xs">
                            {formatTimeAgo(run.finished_at)}
                          </span>
                          <span className="text-zinc-400 text-xs">
                            {formatDuration(run.duration_ms)}
                          </span>
                          <span className="text-right text-zinc-300">
                            {run.discovered}
                          </span>
                          <span className="text-right text-emerald-400">
                            {run.written}
                          </span>
                          <span
                            className={`text-right ${run.errors_count > 0 ? "text-red-400" : "text-zinc-600"}`}
                          >
                            {run.errors_count}
                          </span>
                          <span className="text-right text-zinc-600 text-xs">
                            {expandedRunId === run.id ? "▲" : "▼"}
                          </span>
                        </div>

                        {/* Expanded detail */}
                        {expandedRunId === run.id && (
                          <div className="px-3 py-3 bg-zinc-900/30 border-b border-zinc-800/50 text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-zinc-400 max-w-md">
                              <span>Run ID</span>
                              <span className="text-zinc-300 font-mono truncate">
                                {run.run_id}
                              </span>
                              <span>Runtime</span>
                              <span className="text-zinc-300">
                                {run.runtime}
                              </span>
                              <span>Started</span>
                              <span className="text-zinc-300">
                                {new Date(run.started_at).toLocaleString()}
                              </span>
                              <span>Finished</span>
                              <span className="text-zinc-300">
                                {new Date(run.finished_at).toLocaleString()}
                              </span>
                              {run.refresh_checked != null && (
                                <>
                                  <span>Refresh checked</span>
                                  <span className="text-zinc-300">
                                    {run.refresh_checked}
                                  </span>
                                </>
                              )}
                              {run.refresh_updated != null && (
                                <>
                                  <span>Refresh updated</span>
                                  <span className="text-zinc-300">
                                    {run.refresh_updated}
                                  </span>
                                </>
                              )}
                              {run.details_fetched != null && (
                                <>
                                  <span>Details fetched</span>
                                  <span className="text-zinc-300">
                                    {run.details_fetched}
                                  </span>
                                </>
                              )}
                              {run.normalized != null && (
                                <>
                                  <span>Normalized</span>
                                  <span className="text-zinc-300">
                                    {run.normalized}
                                  </span>
                                </>
                              )}
                              {run.skipped_duplicate != null &&
                                run.skipped_duplicate > 0 && (
                                  <>
                                    <span>Skipped duplicate</span>
                                    <span className="text-zinc-300">
                                      {run.skipped_duplicate}
                                    </span>
                                  </>
                                )}
                              {run.bot_blocked != null &&
                                run.bot_blocked > 0 && (
                                  <>
                                    <span>Bot blocked</span>
                                    <span className="text-amber-400">
                                      {run.bot_blocked}
                                    </span>
                                  </>
                                )}
                              {run.backfill_discovered != null && (
                                <>
                                  <span>Backfill discovered</span>
                                  <span className="text-zinc-300">
                                    {run.backfill_discovered}
                                  </span>
                                </>
                              )}
                              {run.backfill_written != null && (
                                <>
                                  <span>Backfill written</span>
                                  <span className="text-zinc-300">
                                    {run.backfill_written}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Source counts */}
                            {run.source_counts &&
                              Object.keys(run.source_counts).length > 0 && (
                                <div className="mt-2">
                                  <p className="text-zinc-500 mb-1 font-medium">
                                    Source breakdown
                                  </p>
                                  <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 max-w-sm">
                                    <span className="text-zinc-600">
                                      Source
                                    </span>
                                    <span className="text-zinc-600 text-right">
                                      Disc.
                                    </span>
                                    <span className="text-zinc-600 text-right">
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
                                        <span className="text-zinc-300">
                                          {src}
                                        </span>
                                        <span className="text-zinc-400 text-right">
                                          {c.discovered}
                                        </span>
                                        <span className="text-emerald-400 text-right">
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
                                  <p className="text-red-400 mb-1 font-medium">
                                    Errors
                                  </p>
                                  <div className="space-y-0.5">
                                    {run.error_messages.map((msg, i) => (
                                      <p
                                        key={i}
                                        className="text-red-300/80 font-mono text-[11px] truncate"
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
            <DailyTrendsSection aggregates={dailyAggregates} />
          </TabsContent>

          {/* ── Section 4: Data Quality ── */}
          <TabsContent value="quality">
            <DataQualitySection data={dataQuality} />
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

  const dates = Array.from(dateMap.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

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
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-zinc-200">
            Daily Trends (30 days)
          </CardTitle>
          <Select value={selectedScraper} onValueChange={setSelectedScraper}>
            <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-700 text-zinc-300">
              <SelectValue placeholder="All scrapers" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
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
          <p className="text-sm text-zinc-600 py-8 text-center">
            No aggregate data available
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-[100px_100px_60px_60px_60px_80px_80px_60px_80px] gap-2 px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 font-medium">
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
                  className="grid grid-cols-[100px_100px_60px_60px_60px_80px_80px_60px_80px] gap-2 px-3 py-2 text-sm border-b border-zinc-800/50 hover:bg-zinc-900/50"
                >
                  <span className="text-zinc-500 text-xs">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-zinc-300 text-xs">
                    {SCRAPER_LABELS[agg.scraper_name as ScraperName] ??
                      agg.scraper_name}
                  </span>
                  <span className="text-right text-zinc-400">
                    {agg.total_runs}
                  </span>
                  <span className="text-right text-emerald-400">
                    {agg.successful_runs}
                  </span>
                  <span
                    className={`text-right ${agg.failed_runs > 0 ? "text-red-400" : "text-zinc-600"}`}
                  >
                    {agg.failed_runs}
                  </span>
                  <span className="text-right text-zinc-300">
                    {agg.total_discovered}
                  </span>
                  <span className="text-right text-emerald-400">
                    {agg.total_written}
                  </span>
                  <span
                    className={`text-right ${agg.total_errors > 0 ? "text-amber-400" : "text-zinc-600"}`}
                  >
                    {agg.total_errors}
                  </span>
                  <span className="text-right text-zinc-400 text-xs">
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
    <Card className="bg-zinc-950 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-base text-zinc-200">
          Data Quality (last 7 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-zinc-600 py-8 text-center">
            No quality data available
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-[140px_100px_100px_100px_100px] gap-2 px-3 py-2 text-xs text-zinc-500 border-b border-zinc-800 font-medium">
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
                  className="grid grid-cols-[140px_100px_100px_100px_100px] gap-2 px-3 py-2.5 text-sm border-b border-zinc-800/50 hover:bg-zinc-900/50"
                >
                  <span className="text-zinc-300">{row.source}</span>
                  <span className="text-right">
                    {row.avg_quality != null ? (
                      <span
                        className={
                          row.avg_quality >= 0.7
                            ? "text-emerald-400"
                            : row.avg_quality >= 0.4
                              ? "text-amber-400"
                              : "text-red-400"
                        }
                      >
                        {(row.avg_quality * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </span>
                  <span className="text-right text-zinc-400">
                    {row.total_listings}
                  </span>
                  <span className="text-right">
                    <span
                      className={
                        imgPct >= 80
                          ? "text-emerald-400"
                          : imgPct >= 50
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {imgPct}%
                    </span>
                    <span className="text-zinc-600 ml-1 text-xs">
                      ({row.listings_with_images})
                    </span>
                  </span>
                  <span className="text-right">
                    <span
                      className={
                        pricePct >= 80
                          ? "text-emerald-400"
                          : pricePct >= 50
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {pricePct}%
                    </span>
                    <span className="text-zinc-600 ml-1 text-xs">
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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  DataQualityOverviewResponse,
  SourceHealth,
  MaintenanceHealth,
} from '@/app/api/admin/data-quality/overview/route';

type Status = 'green' | 'yellow' | 'red';

interface ScraperRunDetail {
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

interface DrillDownData {
  scraperName: string;
  knownInRegistry: boolean;
  recentRuns: ScraperRunDetail[];
}

const REFRESH_MS = 30_000;

const statusDot: Record<Status, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

const statusTextClass: Record<Status, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-amber-700 dark:text-amber-300',
  red: 'text-red-600 dark:text-red-400',
};

const statusBorder: Record<Status, string> = {
  green: 'border-emerald-500/30',
  yellow: 'border-amber-400/40',
  red: 'border-red-500/50',
};

function formatAgo(iso: string | null, now: number): string {
  if (!iso) return 'never';
  const diffMs = now - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatInt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

export default function DataQualityClient({ locale }: { locale: string }) {
  const [data, setData] = useState<DataQualityOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<{ type: 'source' | 'scraper' | 'maintenance'; name: string } | null>(null);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    if (!opts?.silent) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/data-quality/overview', {
        cache: 'no-store',
        signal: ac.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.message ?? json?.code ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setData(json.data as DataQualityOverviewResponse);
      setError(null);
    } catch (e: unknown) {
      if ((e as { name?: string }).name === 'AbortError') return;
      setError((e as Error).message ?? 'unknown error');
    } finally {
      if (!opts?.silent) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const loadDrillDown = useCallback(async (scraperName: string) => {
    setDrillLoading(true);
    setDrillError(null);
    setDrillDown(null);
    try {
      const res = await fetch(
        `/api/admin/data-quality/scraper/${encodeURIComponent(scraperName)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDrillDown(json.data as DrillDownData);
    } catch (e: unknown) {
      setDrillError((e as Error).message ?? 'failed to load');
    } finally {
      setDrillLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.type === 'scraper' || selected?.type === 'maintenance') {
      loadDrillDown(selected.name);
    } else if (selected?.type === 'source' && data) {
      const src = data.sources.find((s) => s.sourceId === selected.name);
      if (src && src.scrapers[0]) loadDrillDown(src.scrapers[0].name);
    }
  }, [selected, loadDrillDown, data]);

  const summary = useMemo(() => {
    if (!data) return null;
    const healthy = data.sources.filter((s) => s.status === 'green').length;
    const maintHealthy = data.maintenance.filter((m) => m.status === 'green').length;
    return {
      sourcesHealthy: healthy,
      sourcesTotal: data.sources.length,
      maintHealthy,
      maintTotal: data.maintenance.length,
      redAlerts: data.alerts.filter((a) => a.level === 'red').length,
      yellowAlerts: data.alerts.filter((a) => a.level === 'yellow').length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="h-10 w-10 rounded-full border-2 border-border" />
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Loading live data quality...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground p-10">
        <h1 className="text-xl font-semibold mb-4">Data Quality — load failed</h1>
        <p className="text-red-600 dark:text-red-400 mb-4">{error ?? 'no data'}</p>
        <button onClick={() => load()} className="px-4 py-2 rounded bg-amber-500 text-black text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header strip */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-6">
            <div>
              <h1 className="text-lg font-semibold">Data Quality</h1>
              <p className="text-xs text-muted-foreground">Truth-telling view of scraper & cron health</p>
            </div>
            {summary && (
              <div className="flex items-center gap-6 text-sm">
                <Stat label="Sources healthy" value={`${summary.sourcesHealthy} / ${summary.sourcesTotal}`} tone={summary.sourcesHealthy === summary.sourcesTotal ? 'green' : 'yellow'} />
                <Stat label="Maintenance healthy" value={`${summary.maintHealthy} / ${summary.maintTotal}`} tone={summary.maintHealthy === summary.maintTotal ? 'green' : 'yellow'} />
                <Stat label="Red" value={String(summary.redAlerts)} tone={summary.redAlerts === 0 ? 'green' : 'red'} />
                <Stat label="Yellow" value={String(summary.yellowAlerts)} tone={summary.yellowAlerts === 0 ? 'green' : 'yellow'} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              updated {formatAgo(data.generatedAt, now)}
            </span>
            <label className="flex items-center gap-2 text-muted-foreground">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-amber-500" />
              auto-refresh
            </label>
            <button
              onClick={() => load()}
              disabled={refreshing}
              className="px-3 py-1.5 rounded bg-amber-500 text-black font-medium hover:bg-amber-400 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
            <Link href={`/${locale}/admin/scrapers`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Scrapers console →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* Main column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Alerts */}
          {data.alerts.length > 0 && (
            <section className="rounded-lg border border-border bg-card">
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Alerts <span className="text-muted-foreground font-normal">({data.alerts.length})</span>
                </h2>
              </header>
              <ul className="divide-y divide-border/60">
                {data.alerts.map((a, i) => (
                  <li key={`${a.target}-${i}`} className="px-4 py-3 flex items-start gap-3 text-sm">
                    <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${statusDot[a.level]}`} />
                    <div className="flex-1">
                      <p className="text-foreground">{a.message}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        {a.scope} · {a.target}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelected({ type: a.scope === 'source' ? 'source' : a.scope === 'maintenance' ? 'maintenance' : 'scraper', name: a.target })}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:text-amber-300 underline underline-offset-2"
                    >
                      inspect
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Source grid */}
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Marketplace sources
              <span className="text-muted-foreground font-normal">({data.sources.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.sources.map((s) => (
                <SourceCard
                  key={s.sourceId}
                  source={s}
                  now={now}
                  selected={selected?.type === 'source' && selected.name === s.sourceId}
                  onClick={() => setSelected({ type: 'source', name: s.sourceId })}
                />
              ))}
            </div>
          </section>

          {/* Maintenance / enrichment jobs */}
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              Maintenance & enrichment jobs
              <span className="text-muted-foreground font-normal">({data.maintenance.length})</span>
            </h2>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Job</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-left px-4 py-2 font-medium">Last run</th>
                    <th className="text-right px-4 py-2 font-medium">Dur.</th>
                    <th className="text-right px-4 py-2 font-medium">Written</th>
                    <th className="text-right px-4 py-2 font-medium">Runs 24h</th>
                    <th className="text-right px-4 py-2 font-medium">Fail 7d</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.maintenance.map((m) => (
                    <MaintenanceRow
                      key={m.scraperName}
                      m={m}
                      now={now}
                      selected={selected?.type === 'maintenance' && selected.name === m.scraperName}
                      onClick={() => setSelected({ type: 'maintenance', name: m.scraperName })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Unknown active runs */}
          {data.unknownActiveRuns.length > 0 && (
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="text-sm font-semibold mb-2 text-amber-700 dark:text-amber-300">Unknown active runs</h3>
              <p className="text-xs text-muted-foreground mb-2">
                These scraper_names have active rows but are not in <code className="text-foreground">sourceRegistry.ts</code>. Add them to the registry or investigate.
              </p>
              <ul className="text-xs space-y-1">
                {data.unknownActiveRuns.map((u) => (
                  <li key={u.runId} className="text-foreground">
                    <code className="text-amber-800 dark:text-amber-200">{u.scraperName}</code> — {u.ageMinutes}m old ({u.runId.slice(0, 8)}…)
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Drill-down panel */}
        <aside className="col-span-12 lg:col-span-4">
          <DrillDownPanel
            selected={selected}
            sourceData={selected?.type === 'source' ? data.sources.find((s) => s.sourceId === selected.name) : null}
            maintenanceData={selected?.type === 'maintenance' ? data.maintenance.find((m) => m.scraperName === selected.name) : null}
            drillDown={drillDown}
            loading={drillLoading}
            error={drillError}
            now={now}
            onSelectScraper={(name) => setSelected({ type: 'scraper', name })}
          />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: Status }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${statusTextClass[tone]}`}>{value}</span>
    </div>
  );
}

function SourceCard({
  source,
  now,
  selected,
  onClick,
}: {
  source: SourceHealth;
  now: number;
  selected: boolean;
  onClick: () => void;
}) {
  const ingest = source.ingestion;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border bg-card p-4 transition-colors ${
        selected ? 'border-amber-500 ring-1 ring-amber-500/40' : statusBorder[source.status] + ' hover:border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDot[source.status]}`} />
            <h3 className="text-sm font-semibold">{source.label}</h3>
          </div>
          {source.statusReasons.length > 0 && (
            <p className={`text-xs mt-1 ${statusTextClass[source.status]}`}>{source.statusReasons[0]}</p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{source.sourceId}</span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Metric label="Last listing" value={formatAgo(ingest.lastListingAt, now)} />
        <Metric label="+24h" value={formatInt(ingest.new24h)} highlight={ingest.new24h > 0} />
        <Metric label="Active" value={formatInt(ingest.totalActive)} />
        <Metric label="+7d" value={formatInt(ingest.new7d)} />
        <Metric label="Updated 24h" value={formatInt(ingest.updated24h)} />
        <Metric label="Total" value={formatInt(ingest.totalAll)} />
      </dl>

      {Object.keys(source.fieldCompleteness).length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Field completeness</p>
          <div className="grid grid-cols-4 gap-1.5 text-[10px]">
            {Object.entries(source.fieldCompleteness).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-1">
                <span className="text-muted-foreground">{k}</span>
                <span className={v >= 80 ? 'text-emerald-600 dark:text-emerald-400' : v >= 50 ? 'text-amber-700 dark:text-amber-300' : 'text-red-600 dark:text-red-400'}>
                  {v.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-1.5">
        {source.scrapers.map((sc) => {
          const scStatus: Status = sc.lastRunSuccess === false ? 'red' : (sc.active?.state === 'stalled' || sc.active?.state === 'orphaned') ? 'yellow' : 'green';
          return (
            <span
              key={sc.name}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                scStatus === 'red'
                  ? 'border-red-500/40 text-red-700 dark:text-red-300'
                  : scStatus === 'yellow'
                    ? 'border-amber-500/40 text-amber-800 dark:text-amber-200'
                    : 'border-border text-muted-foreground'
              }`}
              title={sc.active?.note ?? ''}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot[scStatus]}`} />
              {sc.name}
              {sc.active && (
                <span className="text-muted-foreground">
                  ·{sc.active.ageMinutes}m
                  {sc.active.state === 'orphaned' && <span className="text-amber-700 dark:text-amber-300"> orph</span>}
                  {sc.active.state === 'stalled' && <span className="text-red-700 dark:text-red-300"> stall</span>}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </button>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`text-sm font-mono ${highlight ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>{value}</dd>
    </div>
  );
}

function MaintenanceRow({
  m,
  now,
  selected,
  onClick,
}: {
  m: MaintenanceHealth;
  now: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <tr onClick={onClick} className={`cursor-pointer hover:bg-muted/40 ${selected ? 'bg-amber-500/5' : ''}`}>
      <td className="px-4 py-2.5">
        <div className="font-mono text-xs text-foreground">{m.scraperName}</div>
        <div className="text-[10px] text-muted-foreground">{m.purpose}</div>
      </td>
      <td className="px-4 py-2.5">
        <span className={`inline-flex items-center gap-1.5 text-xs ${statusTextClass[m.status]}`}>
          <span className={`h-2 w-2 rounded-full ${statusDot[m.status]}`} />
          {m.status}
        </span>
        {m.statusReasons[0] && <div className="text-[10px] text-muted-foreground mt-0.5">{m.statusReasons[0]}</div>}
      </td>
      <td className="px-4 py-2.5 text-foreground text-xs">
        {formatAgo(m.lastRunAt, now)}
        {m.lastRunSuccess === false && <span className="ml-1 text-red-600 dark:text-red-400">(failed)</span>}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatMs(m.lastRunDurationMs)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatInt(m.lastRunWritten)}</td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{m.runs24h}</td>
      <td className={`px-4 py-2.5 text-right font-mono text-xs ${m.failures7d > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground/60'}`}>
        {m.failures7d}
      </td>
      <td className="px-4 py-2.5 text-right text-xs text-amber-600 dark:text-amber-400">inspect →</td>
    </tr>
  );
}

function DrillDownPanel({
  selected,
  sourceData,
  maintenanceData,
  drillDown,
  loading,
  error,
  now,
  onSelectScraper,
}: {
  selected: { type: 'source' | 'scraper' | 'maintenance'; name: string } | null;
  sourceData: SourceHealth | null | undefined;
  maintenanceData: MaintenanceHealth | null | undefined;
  drillDown: DrillDownData | null;
  loading: boolean;
  error: string | null;
  now: number;
  onSelectScraper: (name: string) => void;
}) {
  if (!selected) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground sticky top-24">
        <p className="mb-2 text-foreground font-medium">Drill-down</p>
        <p>Click any source, maintenance job, or alert to inspect the last 20 runs, error messages, and per-run counts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{selected.type}</p>
          <h3 className="text-sm font-semibold font-mono">
            {sourceData?.label ?? maintenanceData?.label ?? selected.name}
          </h3>
        </div>
      </header>

      {sourceData && (
        <div className="px-4 py-3 border-b border-border/60 space-y-2 text-xs">
          <div className="text-muted-foreground">Scrapers writing to {sourceData.label}:</div>
          <div className="flex flex-wrap gap-1.5">
            {sourceData.scrapers.map((sc) => (
              <button
                key={sc.name}
                onClick={() => onSelectScraper(sc.name)}
                className="px-2 py-1 rounded border border-border hover:border-amber-500 font-mono text-[11px]"
              >
                {sc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {maintenanceData && (
        <div className="px-4 py-3 border-b border-border/60 space-y-2 text-xs">
          <p className="text-muted-foreground">{maintenanceData.purpose}</p>
          {maintenanceData.lastRunErrorMessages && maintenanceData.lastRunErrorMessages.length > 0 && (
            <div>
              <p className="text-red-600 dark:text-red-400 text-[10px] uppercase tracking-wider">Last errors</p>
              <ul className="text-[11px] font-mono text-red-700 dark:text-red-300 mt-1 space-y-0.5">
                {maintenanceData.lastRunErrorMessages.slice(0, 3).map((msg, i) => (
                  <li key={i} className="truncate" title={msg}>• {msg}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Last 20 runs{drillDown && ` — ${drillDown.scraperName}`}
        </h4>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {drillDown && !loading && (
          <>
            {drillDown.recentRuns.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recorded runs in the last 7+ days.</p>
            ) : (
              <ul className="space-y-2">
                {drillDown.recentRuns.map((r) => (
                  <li key={r.id} className="rounded border border-border bg-muted/40 p-2 text-[11px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className={r.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {r.success ? '✓' : '✗'} {formatAgo(r.started_at, now)}
                      </span>
                      <span className="text-muted-foreground font-mono">{formatMs(r.duration_ms)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-muted-foreground font-mono">
                      <span>disc {formatInt(r.discovered)}</span>
                      <span>wrote {formatInt(r.written)}</span>
                      <span className={(r.errors_count ?? 0) > 0 ? 'text-red-600 dark:text-red-400' : ''}>
                        err {formatInt(r.errors_count)}
                      </span>
                    </div>
                    {r.error_messages && r.error_messages.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-red-600 dark:text-red-400 cursor-pointer">
                          {r.error_messages.length} error message{r.error_messages.length === 1 ? '' : 's'}
                        </summary>
                        <ul className="text-red-700 dark:text-red-300 font-mono text-[10px] mt-1 space-y-0.5 pl-2">
                          {r.error_messages.slice(0, 5).map((m, i) => (
                            <li key={i} className="break-all">• {m}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="text-[9px] text-muted-foreground/60 mt-1 font-mono">
                      {r.runtime} · {r.run_id.slice(0, 8)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

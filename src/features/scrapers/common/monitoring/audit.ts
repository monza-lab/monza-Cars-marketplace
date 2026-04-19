import type { ActiveScraperRun, ScraperName, ScraperRun } from "./types";

export type AuditCadence = "daily" | "external" | "manual";
export type AuditStatus = "working" | "degraded" | "failed" | "stale" | "stuck" | "zero-write" | "idle";

export interface ScraperJobSpec {
  scraperName: ScraperName;
  label: string;
  cadence: AuditCadence;
  cronPath?: string;
}

export interface ScraperHealthSummary {
  scraperName: ScraperName;
  label: string;
  cadence: AuditCadence;
  cronPath?: string;
  runsInWindow: number;
  successfulRuns: number;
  failedRuns: number;
  totalDiscovered: number;
  totalWritten: number;
  totalErrors: number;
  lastRunAt: string | null;
  lastRunSuccess: boolean | null;
  lastRunWritten: number | null;
  activeAgeMinutes: number | null;
  status: AuditStatus;
  notes: string[];
}

export function summarizeScraperHealth(
  spec: ScraperJobSpec,
  runs: ScraperRun[],
  activeRun: ActiveScraperRun | null | undefined,
  nowMs: number = Date.now(),
): ScraperHealthSummary {
  const orderedRuns = [...runs].sort(
    (left, right) => Date.parse(right.finished_at) - Date.parse(left.finished_at),
  );

  const runsInWindow = orderedRuns.length;
  const successfulRuns = orderedRuns.filter((run) => run.success).length;
  const failedRuns = runsInWindow - successfulRuns;
  const totalDiscovered = orderedRuns.reduce((sum, run) => sum + (run.discovered ?? 0), 0);
  const totalWritten = orderedRuns.reduce((sum, run) => sum + (run.written ?? 0), 0);
  const totalErrors = orderedRuns.reduce((sum, run) => sum + (run.errors_count ?? 0), 0);
  const lastRun = orderedRuns[0] ?? null;

  const notes: string[] = [];
  const activeAgeMinutes = activeRun
    ? Math.max(0, Math.round((nowMs - Date.parse(activeRun.updated_at)) / 60000))
    : null;

  let status: AuditStatus = "idle";

  if (runsInWindow === 0) {
    if (spec.cadence === "daily") {
      status = "stale";
      notes.push("No runs in the requested window for a scheduled job");
    } else {
      status = "idle";
      notes.push("No recent runs recorded");
    }
  } else if (successfulRuns === 0) {
    status = "failed";
    notes.push("All recent runs failed");
  } else if (totalErrors > 0) {
    status = "degraded";
    notes.push("Recent runs had errors");
  } else if (totalWritten === 0) {
    status = "zero-write";
    notes.push("Recent runs wrote nothing");
  } else if (totalWritten > 0) {
    status = "working";
  }

  if (activeAgeMinutes !== null && activeAgeMinutes > 30) {
    status = "stuck";
    notes.push(`Active run last updated ${activeAgeMinutes} minutes ago`);
  }

  return {
    scraperName: spec.scraperName,
    label: spec.label,
    cadence: spec.cadence,
    cronPath: spec.cronPath,
    runsInWindow,
    successfulRuns,
    failedRuns,
    totalDiscovered,
    totalWritten,
    totalErrors,
    lastRunAt: lastRun?.finished_at ?? null,
    lastRunSuccess: lastRun?.success ?? null,
    lastRunWritten: lastRun ? lastRun.written : null,
    activeAgeMinutes,
    status,
    notes,
  };
}

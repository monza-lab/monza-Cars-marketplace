import type { ActiveScraperRun, ScraperRun } from "./types";

export type ScraperHealthState =
  | "healthy"
  | "degraded"
  | "failed"
  | "zero-output-success"
  | "running";

const STALE_MULTIPLIER = 1.5;
const RUNNING_STALLED_AFTER_MS = 20 * 60 * 1000;

function isRunStale(
  cadenceMs: number,
  finishedAt: string
): boolean {
  const cadence = cadenceMs;
  return Date.now() - new Date(finishedAt).getTime() > cadence * STALE_MULTIPLIER;
}

function isActiveRunStalled(activeRun: ActiveScraperRun): boolean {
  return Date.now() - new Date(activeRun.started_at).getTime() > RUNNING_STALLED_AFTER_MS;
}

export function getScraperHealthState(
  run: ScraperRun | undefined,
  activeRun?: ActiveScraperRun,
  cadenceMs: number = 24 * 60 * 60 * 1000
): ScraperHealthState {
  if (activeRun && !isActiveRunStalled(activeRun)) {
    return "running";
  }

  if (!run || !run.success) {
    return "failed";
  }

  if (run.discovered === 0 && run.written === 0 && run.errors_count === 0) {
    return "zero-output-success";
  }

  if (
    run.errors_count > 0 ||
    run.written === 0 ||
    isRunStale(cadenceMs, run.finished_at)
  ) {
    return "degraded";
  }

  return "healthy";
}

export function getScraperHealthLabel(state: ScraperHealthState): string {
  switch (state) {
    case "running":
      return "RUNNING";
    case "healthy":
      return "HEALTHY";
    case "degraded":
      return "DEGRADED";
    case "zero-output-success":
      return "ZERO OUTPUT";
    case "failed":
      return "FAILED";
  }
}

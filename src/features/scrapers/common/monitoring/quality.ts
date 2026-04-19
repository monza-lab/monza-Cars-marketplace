/**
 * Scraper quality gate — placeholder for future implementation.
 * classifyScraperRun / ScraperRunHealth types are not yet implemented.
 */

export interface ScraperRunHealth {
  state: 'healthy' | 'degraded' | 'failed';
  reason: string;
  flags: string[];
}

export interface ScraperRunHealthInput {
  success: boolean;
  discovered: number;
  written: number;
  errorsCount: number;
  photosCount: number;
  expectedPhotosMin?: number;
}

export interface ScraperQualityGateResult {
  health: ScraperRunHealth;
  issues: Array<'run_failed' | 'zero_output' | 'image_gap'>;
  wouldFail: boolean;
  passed: boolean;
  exitCode: 0 | 1;
  dryRun: boolean;
}

export interface ScraperQualityGateOptions {
  dryRun?: boolean;
}

function classifyScraperRun(input: ScraperRunHealthInput): ScraperRunHealth {
  if (!input.success) {
    return { state: 'failed', reason: 'run_failed', flags: [] };
  }
  const flags: string[] = [];
  if (input.expectedPhotosMin && input.photosCount < input.expectedPhotosMin) {
    flags.push('image_gap');
  }
  if (input.discovered === 0 && input.written === 0) {
    return { state: 'degraded', reason: 'zero_output', flags };
  }
  if (input.errorsCount > 0) {
    return { state: 'degraded', reason: 'errors', flags };
  }
  return { state: 'healthy', reason: 'ok', flags };
}

export function evaluateScraperQualityGate(
  input: ScraperRunHealthInput,
  options: ScraperQualityGateOptions = {},
): ScraperQualityGateResult {
  const dryRun = options.dryRun ?? false;
  const health = classifyScraperRun(input);
  const issues: ScraperQualityGateResult['issues'] = [];

  if (health.state === 'failed') {
    issues.push('run_failed');
  }

  if (health.reason === 'zero_output') {
    issues.push('zero_output');
  }

  if (health.flags.includes('image_gap')) {
    issues.push('image_gap');
  }

  const wouldFail = issues.length > 0;

  return {
    health,
    issues,
    wouldFail,
    passed: dryRun ? true : !wouldFail,
    exitCode: dryRun ? 0 : wouldFail ? 1 : 0,
    dryRun,
  };
}

export function formatScraperQualityGateResult(
  scraperName: string,
  result: ScraperQualityGateResult,
): string {
  const status = result.wouldFail ? 'FAIL' : 'PASS';
  const issues = result.issues.length > 0 ? result.issues.join(',') : 'none';
  const mode = result.dryRun ? 'dry-run' : 'live';
  return `[scraper-quality] ${scraperName} ${mode} ${status} health=${result.health.state}/${result.health.reason} issues=${issues}`;
}

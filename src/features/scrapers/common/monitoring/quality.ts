import { classifyScraperRun } from './health';
import type { ScraperRunHealth, ScraperRunHealthInput } from './types';

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

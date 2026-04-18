import type {
  ScraperImageCoverage,
  ScraperImageCoverageMap,
  ScraperRunHealth,
  ScraperRunHealthInput,
} from './types';

function isCoverageBucket(value: unknown): value is ScraperImageCoverage {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as ScraperImageCoverage).withImages === 'number' &&
      typeof (value as ScraperImageCoverage).missingImages === 'number',
  );
}

function aggregateImageCoverageMap(input: ScraperImageCoverageMap): ScraperImageCoverage {
  return Object.values(input).reduce<ScraperImageCoverage>(
    (acc, bucket) => ({
      withImages: acc.withImages + bucket.withImages,
      missingImages: acc.missingImages + bucket.missingImages,
      deadUrls: acc.deadUrls + (bucket.deadUrls ?? 0),
    }),
    { withImages: 0, missingImages: 0, deadUrls: 0 },
  );
}

function getImageCoverage(input: ScraperRunHealthInput): ScraperImageCoverage | undefined {
  const coverage = input.imageCoverage ?? input.image_coverage;
  if (!coverage) return undefined;
  if (isCoverageBucket(coverage)) return coverage;
  return aggregateImageCoverageMap(coverage);
}

function getErrorsCount(input: ScraperRunHealthInput): number {
  return input.errorsCount ?? input.errors_count ?? 0;
}

export function classifyScraperRun(input: ScraperRunHealthInput): ScraperRunHealth {
  const imageCoverage = getImageCoverage(input);
  const errorsCount = getErrorsCount(input);
  const flags = imageCoverage && imageCoverage.missingImages > 0 ? ['image_gap'] as const : [];

  if (!input.success) {
    return {
      state: 'failed',
      reason: 'run_failed',
      flags: [...flags],
    };
  }

  if (input.discovered > 0 && input.written === 0) {
    return {
      state: 'degraded',
      reason: 'zero_output',
      flags: [...flags],
    };
  }

  if (errorsCount > 0) {
    return {
      state: 'degraded',
      reason: 'errors_present',
      flags: [...flags],
    };
  }

  if (flags.length > 0) {
    return {
      state: 'degraded',
      reason: 'image_gap',
      flags: [...flags],
    };
  }

  return {
    state: 'healthy',
    reason: 'ok',
    flags: [],
  };
}

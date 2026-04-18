import { describe, expect, it } from 'vitest';

import { classifyScraperRun } from './index';

describe('classifyScraperRun', () => {
  it('returns healthy for a successful run without errors or image gaps', () => {
    expect(
      classifyScraperRun({
        success: true,
        discovered: 12,
        written: 12,
        errorsCount: 0,
        imageCoverage: {
          withImages: 12,
          missingImages: 0,
        },
      })
    ).toEqual({
      state: 'healthy',
      reason: 'ok',
      flags: [],
    });
  });

  it('returns degraded with image_gap when images are missing', () => {
    expect(
      classifyScraperRun({
        success: true,
        discovered: 8,
        written: 8,
        errorsCount: 0,
        imageCoverage: {
          withImages: 6,
          missingImages: 2,
        },
      })
    ).toEqual({
      state: 'degraded',
      reason: 'image_gap',
      flags: ['image_gap'],
    });
  });

  it('prefers zero_output as the degradation reason while preserving image_gap', () => {
    expect(
      classifyScraperRun({
        success: true,
        discovered: 1040,
        written: 0,
        errorsCount: 2,
        imageCoverage: {
          withImages: 0,
          missingImages: 1040,
        },
      })
    ).toEqual({
      state: 'degraded',
      reason: 'zero_output',
      flags: ['image_gap'],
    });
  });

  it('returns failed when the run itself failed', () => {
    expect(
      classifyScraperRun({
        success: false,
        discovered: 3,
        written: 0,
        errorsCount: 1,
        imageCoverage: {
          withImages: 0,
          missingImages: 3,
        },
      })
    ).toEqual({
      state: 'failed',
      reason: 'run_failed',
      flags: ['image_gap'],
    });
  });
});

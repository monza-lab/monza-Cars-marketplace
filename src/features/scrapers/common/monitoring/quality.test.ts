import { describe, expect, it } from 'vitest';
import { evaluateScraperQualityGate } from './quality';

describe('evaluateScraperQualityGate', () => {
  it('passes a healthy run', () => {
    const result = evaluateScraperQualityGate({
      success: true,
      discovered: 12,
      written: 12,
      errors_count: 0,
    });

    expect(result).toMatchObject({
      wouldFail: false,
      passed: true,
      exitCode: 0,
      issues: [],
      health: {
        state: 'healthy',
        reason: 'ok',
      },
    });
  });

  it('fails on zero output', () => {
    const result = evaluateScraperQualityGate({
      success: true,
      discovered: 8,
      written: 0,
      errors_count: 0,
    });

    expect(result).toMatchObject({
      wouldFail: true,
      passed: false,
      exitCode: 1,
      issues: ['zero_output'],
      health: {
        state: 'degraded',
        reason: 'zero_output',
      },
    });
  });

  it('fails on image gaps when image coverage is present', () => {
    const result = evaluateScraperQualityGate({
      success: true,
      discovered: 20,
      written: 20,
      errors_count: 0,
      image_coverage: {
        AutoScout24: { withImages: 9, missingImages: 11, deadUrls: 0 },
      },
    });

    expect(result).toMatchObject({
      wouldFail: true,
      passed: false,
      exitCode: 1,
      issues: ['image_gap'],
      health: {
        state: 'degraded',
        reason: 'image_gap',
        flags: ['image_gap'],
      },
    });
  });

  it('allows a dry run to report failures without exiting non-zero', () => {
    const result = evaluateScraperQualityGate(
      {
        success: true,
        discovered: 8,
        written: 0,
        errors_count: 0,
      },
      {
        dryRun: true,
      },
    );

    expect(result).toMatchObject({
      wouldFail: true,
      passed: true,
      exitCode: 0,
      dryRun: true,
      issues: ['zero_output'],
    });
  });
});

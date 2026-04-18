function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Returns p25/p50/p75 after Tukey 1.5·IQR outlier trim. Requires n>=8. */
export function iqrBand(values: number[]): { p25: number; p50: number; p75: number } | null {
  if (values.length < 8) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = pct(sorted, 0.25);
  const q3 = pct(sorted, 0.75);
  const iqr = q3 - q1;
  let trimmed = sorted;
  if (iqr > 0) {
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    trimmed = sorted.filter((v) => v >= lo && v <= hi);
    if (trimmed.length < 8) trimmed = sorted;
  }
  return {
    p25: pct(trimmed, 0.25),
    p50: pct(trimmed, 0.5),
    p75: pct(trimmed, 0.75),
  };
}

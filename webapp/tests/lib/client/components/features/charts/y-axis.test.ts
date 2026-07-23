import { describe, it, expect } from 'vitest';
import { scaleLog } from 'd3-scale';
import { chartYBaseline, logSafe } from '$comps/features/charts/y-axis';

/**
 * Regression guard for the log-axis break found during the ES-3031 visual pass.
 *
 * Before the fix, the migrated charts left LayerChart's default y-baseline of 0
 * in place. With a logarithmic scale that puts 0 in the domain, and log(0) is
 * -Infinity, so every point mapped to NaN and the chart rendered nothing
 * (`<path d="M0,NaN…">`). The fix drops the baseline (null) for the log case so
 * the domain comes from the positive data extents, while keeping 0 for linear.
 */
describe('chartYBaseline', () => {
  it('keeps the zero baseline for a linear axis (fill-to-zero parity)', () => {
    expect(chartYBaseline(false)).toBe(0);
  });

  it('drops the baseline for a logarithmic axis so 0 stays out of the domain', () => {
    expect(chartYBaseline(true)).toBeNull();
  });

  it('documents WHY: a log domain that includes the zero baseline yields NaN', () => {
    // What the old code effectively did: domain [min(0, ...data), max(...data)].
    const brokenDomain = scaleLog().domain([0, 100]);
    expect(Number.isNaN(brokenDomain(50))).toBe(true);

    // What the fix does: domain from positive data extents only.
    const fixedDomain = scaleLog().domain([1, 100]);
    expect(Number.isFinite(fixedDomain(50))).toBe(true);
  });
});

describe('logSafe', () => {
  it('passes values through unchanged on a linear axis (including 0 and negatives)', () => {
    expect(logSafe(0, false)).toBe(0);
    expect(logSafe(42, false)).toBe(42);
    expect(logSafe(-5, false)).toBe(-5);
  });

  it('maps non-positive values to null on a log axis (0 and negatives have no log position)', () => {
    // Real Bus data has 0s (empty buckets); a single 0 in a scaleLog series
    // otherwise turns the whole path into NaN and blanks the chart.
    expect(logSafe(0, true)).toBeNull();
    expect(logSafe(-3, true)).toBeNull();
  });

  it('keeps positive values on a log axis', () => {
    expect(logSafe(1, true)).toBe(1);
    expect(logSafe(9999, true)).toBe(9999);
  });

  it('preserves null/undefined as null on both axes', () => {
    expect(logSafe(null, true)).toBeNull();
    expect(logSafe(undefined, false)).toBeNull();
  });

  it('a sanitized log series feeds scaleLog only finite numbers', () => {
    const raw = [0, 5, 0, 80, -1, 20];
    const cleaned = raw.map((v) => logSafe(v, true)).filter((v): v is number => v != null);
    const scale = scaleLog().domain([Math.min(...cleaned), Math.max(...cleaned)]);
    for (const v of cleaned) expect(Number.isFinite(scale(v))).toBe(true);
  });
});

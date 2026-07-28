import { describe, it, expect } from 'vitest';
import { scaleLog } from 'd3-scale';
import { chartYBaseline, logClamp, logFloor } from '$comps/features/charts/y-axis';

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

describe('logFloor', () => {
  it('returns the smallest positive value in the series', () => {
    expect(logFloor([0, 24, 5, 80, -1, 20])).toBe(5);
  });

  it('ignores 0, negatives, and null/undefined', () => {
    expect(logFloor([0, -3, null, undefined, 12])).toBe(12);
  });

  it('falls back to 1 when there is no positive value', () => {
    expect(logFloor([0, -1, null])).toBe(1);
    expect(logFloor([])).toBe(1);
  });
});

describe('logClamp', () => {
  const floor = 5;

  it('passes values through unchanged on a linear axis (including 0 and negatives)', () => {
    expect(logClamp(0, false, floor)).toBe(0);
    expect(logClamp(42, false, floor)).toBe(42);
    expect(logClamp(-5, false, floor)).toBe(-5);
  });

  it('raises non-positive values to the floor on a log axis (continuous, not a gap)', () => {
    // Real Bus data has 0s (empty buckets); a single 0 in a scaleLog series
    // otherwise turns the whole path into NaN and blanks the chart. Flooring
    // (rather than nulling) keeps the line continuous, matching Chart.js.
    expect(logClamp(0, true, floor)).toBe(floor);
    expect(logClamp(-3, true, floor)).toBe(floor);
  });

  it('keeps positive values on a log axis', () => {
    expect(logClamp(1, true, floor)).toBe(1);
    expect(logClamp(9999, true, floor)).toBe(9999);
  });

  it('preserves structural null/undefined as null (deliberate gaps are not floored)', () => {
    expect(logClamp(null, true, floor)).toBeNull();
    expect(logClamp(undefined, false, floor)).toBeNull();
  });

  it('a floored log series feeds scaleLog only finite numbers', () => {
    const raw = [0, 5, 0, 80, -1, 20];
    const f = logFloor(raw);
    const cleaned = raw.map((v) => logClamp(v, true, f)).filter((v): v is number => v != null);
    const scale = scaleLog().domain([Math.min(...cleaned), Math.max(...cleaned)]);
    for (const v of cleaned) expect(Number.isFinite(scale(v))).toBe(true);
  });
});

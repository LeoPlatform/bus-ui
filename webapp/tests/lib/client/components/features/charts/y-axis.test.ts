import { describe, it, expect } from 'vitest';
import { scaleLog } from 'd3-scale';
import { chartYBaseline } from '$comps/features/charts/y-axis';

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

import { describe, it, expect } from 'vitest';
import { computeBucketTotals } from '$comps/features/charts/bucket-totals';
import type { DashboardStatsValue } from '$lib/types';

/**
 * Regression coverage for the bucket line chart's "total" rows (ES-3031).
 * The Chart.js -> LayerChart migration must not change the numbers shown to users,
 * so these tests pin the aggregation windows and override precedence that used to be
 * inline in generic-bucket-line-chart.svelte.
 *
 * Windows (from the original component):
 *   countInBucket     = sum over time in [start, end]              (inclusive)
 *   totalCount        = sum over time in [effectiveRangeStart, end](inclusive)
 *   countInLastBucket = sum over time in [lastBucket, start)       (half-open)
 */

// times: 0..40; value === time so sums are easy to reason about.
const data: DashboardStatsValue[] = Array.from({ length: 5 }, (_, i) => ({
  time: i * 10, // 0, 10, 20, 30, 40
  value: i * 10,
}));

const base = {
  data,
  lastBucket: 10, // "last" bucket window is [10, 20)
  start: 20, // current bucket starts at 20
  end: 40,
  effectiveRangeStart: 0,
};

describe('computeBucketTotals', () => {
  it('sums the current-bucket window [start, end] inclusive of both ends', () => {
    // times 20,30,40 -> 20+30+40
    expect(computeBucketTotals(base).countInBucket).toBe(90);
  });

  it('sums the full window [effectiveRangeStart, end] inclusive', () => {
    // times 0,10,20,30,40 -> 100
    expect(computeBucketTotals(base).totalCount).toBe(100);
  });

  it('sums the last-bucket window [lastBucket, start) excluding start', () => {
    // times in [10, 20) -> only time 10 -> 10 (time 20 is excluded)
    expect(computeBucketTotals(base).countInLastBucket).toBe(10);
  });

  it('honors effectiveRangeStart for totalCount (window can start after 0)', () => {
    // [20, 40] -> 20+30+40 = 90
    expect(computeBucketTotals({ ...base, effectiveRangeStart: 20 }).totalCount).toBe(90);
  });

  it('treats null data as an empty series (all zero)', () => {
    expect(computeBucketTotals({ ...base, data: null })).toEqual({
      countInBucket: 0,
      totalCount: 0,
      countInLastBucket: 0,
    });
  });

  it('ignores non-numeric values rather than producing NaN', () => {
    const dirty = [
      { time: 25, value: Number.NaN },
      { time: 30, value: 5 },
    ] as unknown as DashboardStatsValue[];
    expect(computeBucketTotals({ ...base, data: dirty }).countInBucket).toBe(5);
  });

  describe('override precedence', () => {
    it('uses a finite override in place of the computed value', () => {
      const totals = computeBucketTotals({
        ...base,
        overrideTotal: 12345,
        overrideCountInBucket: 7,
        overrideCountInLastBucket: 3,
      });
      expect(totals.totalCount).toBe(12345);
      expect(totals.countInBucket).toBe(7);
      expect(totals.countInLastBucket).toBe(3);
    });

    it('accepts 0 as a valid override (finite, not falsy-skipped)', () => {
      expect(computeBucketTotals({ ...base, overrideCountInBucket: 0 }).countInBucket).toBe(0);
    });

    it('falls back to the computed value when the override is undefined or non-finite', () => {
      expect(
        computeBucketTotals({ ...base, overrideCountInBucket: undefined }).countInBucket
      ).toBe(90);
      expect(
        computeBucketTotals({ ...base, overrideTotal: Number.NaN }).totalCount
      ).toBe(100);
      expect(
        computeBucketTotals({ ...base, overrideCountInLastBucket: Infinity }).countInLastBucket
      ).toBe(10);
    });
  });
});

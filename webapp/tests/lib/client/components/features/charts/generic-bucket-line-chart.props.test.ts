import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'svelte';
import type GenericBucketLineChart from '$comps/features/charts/generic-bucket-line-chart.svelte';
import type { DashboardStatsValue, StatsRange } from '$lib/types';
import type { ChartOptions } from '$comps/features/chart-details-pane/types';

/**
 * Prop-contract guard for GenericBucketLineChart (ES-3031).
 *
 * The Chart.js -> LayerChart migration is an internal implementation swap: the wrapper's
 * public props are the shape its consumers (bot-dashboard-tab, queue-dashboard-tab,
 * chart-details-pane) depend on, and they must NOT drift. This is a TYPE-LEVEL assertion —
 * it is enforced by `pnpm check` (svelte-check / tsc), not at vitest runtime. If a prop is
 * renamed, removed, retyped, or its optionality flips, `Expected` and `Actual` diverge and
 * the file fails to type-check.
 *
 * This is a regression-style guard added after the fact (the change is internal), not an
 * immutable seam contract test.
 */

// Exact-equality helper (bidirectional, so added/removed props both fail).
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type Actual = ComponentProps<typeof GenericBucketLineChart>;

type Expected = {
  data: DashboardStatsValue[] | null;
  chartLabel: string;
  range: StatsRange;
  start: number;
  end: number;
  rangeStart?: number;
  checkPointValue?: number;
  chartOptions?: ChartOptions;
  formatTotal?: (value: number) => string;
  overrideTotal?: number;
  overrideCountInLastBucket?: number;
  overrideCountInBucket?: number;
  showTitle?: boolean;
  // ES-4034: humanize y-axis/tooltip for duration charts (Execution Time, Read Lag)
  dataIsTimeBased?: boolean;
};

// Compile-time failure here (caught by `pnpm check`) means the prop contract changed.
type _PropContract = Expect<Equal<Actual, Expected>>;

describe('GenericBucketLineChart prop contract', () => {
  it('is enforced at type-check time (see `pnpm check`)', () => {
    // No runtime behavior to assert — the guard is the `_PropContract` type above.
    // This keeps the file visible to `vitest run` alongside the type check.
    expect(true).toBe(true);
  });
});

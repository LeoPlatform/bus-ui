import type { DashboardStatsValue } from "$lib/types";

/**
 * Pure aggregation behind the bucket line chart's three "total" rows.
 *
 * Kept out of the component so the numbers can be regression-tested without rendering: the
 * chart library may change, these sums must not.
 */
export interface BucketTotalsInput {
  data: DashboardStatsValue[] | null;
  /** Start of the current stats bucket (API currentBucketStart). */
  start: number;
  /** End of the query window (API end / time-picker end). */
  end: number;
  /** Start of the query window used for the blue "total" row (API start, aligned). */
  effectiveRangeStart: number;
  /** Start of the previous ("last") bucket. */
  lastBucket: number;
  /** When finite, wins over the computed totalCount. */
  overrideTotal?: number;
  /** When finite, wins over the computed countInBucket. */
  overrideCountInBucket?: number;
  /** When finite, wins over the computed countInLastBucket. */
  overrideCountInLastBucket?: number;
}

export interface BucketTotals {
  /** Sum of values with time in [start, end] (inclusive). */
  countInBucket: number;
  /** Sum of values with time in [effectiveRangeStart, end] (inclusive). */
  totalCount: number;
  /** Sum of values with time in [lastBucket, start) (half-open — excludes start). */
  countInLastBucket: number;
}

/** Use `override` only when it is a finite number; otherwise fall back to the computed value. */
const finiteOr = (n: number | undefined, fallback: number): number =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

const sumWhere = (
  data: DashboardStatsValue[] | null,
  inWindow: (time: number) => boolean
): number =>
  (data ?? []).reduce(
    (acc, p) => (inWindow(p.time) ? acc + (Number(p.value) || 0) : acc),
    0
  );

export function computeBucketTotals(input: BucketTotalsInput): BucketTotals {
  const {
    data,
    start,
    end,
    effectiveRangeStart,
    lastBucket,
    overrideTotal,
    overrideCountInBucket,
    overrideCountInLastBucket,
  } = input;

  return {
    countInBucket: finiteOr(
      overrideCountInBucket,
      sumWhere(data, (t) => t >= start && t <= end)
    ),
    totalCount: finiteOr(
      overrideTotal,
      sumWhere(data, (t) => t >= effectiveRangeStart && t <= end)
    ),
    countInLastBucket: finiteOr(
      overrideCountInLastBucket,
      sumWhere(data, (t) => t >= lastBucket && t < start)
    ),
  };
}

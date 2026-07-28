/**
 * Y-axis baseline helper for the LayerChart line/area charts (ES-3031).
 *
 * LayerChart's LineChart/AreaChart anchor the y-domain at 0 by default
 * (`yBaseline={0}`), so the domain becomes `[min(0, ...values), max(...)]`.
 * That is correct for a linear scale (fills/lines reference zero), but a
 * logarithmic scale cannot contain 0: `log(0) = -Infinity`, which makes every
 * point map to `NaN` and the chart renders an empty `M0,NaN…` path.
 *
 * For the logarithmic case we therefore drop the baseline (`null`) so the domain
 * is derived purely from the data extents (all positive); for the linear case we
 * keep the zero baseline to preserve the prior Chart.js fill-to-zero behavior.
 */
export function chartYBaseline(showLogarithmic: boolean): number | null {
  return showLogarithmic ? null : 0;
}

/**
 * Smallest positive value across a series — the floor used to clamp non-positive
 * values on a log axis (see {@link logClamp}). Falls back to 1 when the series has
 * no positive values (nothing meaningful to plot on a log scale).
 */
export function logFloor(values: Array<number | null | undefined>): number {
  let min = Infinity;
  for (const v of values) {
    if (v != null && v > 0 && v < min) min = v;
  }
  return Number.isFinite(min) ? min : 1;
}

/**
 * Clamp a y-value for the active scale.
 *
 * Real Bus data contains 0s (e.g. buckets with no events/errors). A `scaleLog`
 * cannot place a non-positive value — `log(0) = -Infinity`, `log(-n) = NaN` —
 * so a single 0 in the series turns the whole path into `M0,NaN…` and the chart
 * renders blank. `yBaseline` alone does NOT fix this: it controls the domain, not
 * the per-point values.
 *
 * On a log axis we raise non-positive values to `floor` (the smallest positive
 * value in the series) so the line stays **continuous** and 0s render at the
 * bottom of the axis — matching the prior Chart.js logarithmic behavior — rather
 * than punching gaps into the series. On a linear axis the value passes through
 * unchanged. Structural `null`s (deliberate gaps, e.g. a bucket series outside its
 * window) are preserved as `null`, not floored.
 */
export function logClamp(
  value: number | null | undefined,
  showLogarithmic: boolean,
  floor: number,
): number | null {
  if (value == null) return null;
  if (showLogarithmic && value <= 0) return floor;
  return value;
}

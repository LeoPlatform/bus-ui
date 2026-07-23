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

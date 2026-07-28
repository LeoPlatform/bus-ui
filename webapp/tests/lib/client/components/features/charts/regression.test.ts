import { describe, it, expect } from 'vitest';
import { createRegressionSeries, findBestRegression } from '$comps/features/charts/regression';
import type { DashboardStatsValue } from '$lib/types';

/**
 * createRegressionSeries was reshaped during the Chart.js -> LayerChart migration (ES-3031):
 * it now returns a library-agnostic { points, predict, label } series instead of a Chart.js
 * ChartDataset. These tests pin that contract.
 */

// A clean linear relationship: value = 2 * time (so predictions are exact).
const linearData: DashboardStatsValue[] = Array.from({ length: 10 }, (_, i) => ({
  time: i,
  value: i * 2,
}));

describe('createRegressionSeries', () => {
  it('returns sorted fitted points and a working predictor for a linear fit', () => {
    const series = createRegressionSeries({ data: linearData, type: 'linear', label: 'Trend' });

    expect(series.label).toBe('Trend');
    expect(series.points.length).toBeGreaterThan(0);

    // points are sorted ascending by x (time)
    for (let i = 1; i < series.points.length; i++) {
      expect(series.points[i].x).toBeGreaterThanOrEqual(series.points[i - 1].x);
    }

    // predictor recovers the underlying y = 2x relationship
    expect(series.predict(5)).toBeCloseTo(10, 5);
    expect(series.predict(20)).toBeCloseTo(40, 5);
  });

  it('supports bestFit without an explicit type', () => {
    const series = createRegressionSeries({ data: linearData, bestFit: true });
    expect(series.points.length).toBeGreaterThan(0);
    expect(series.predict(5)).toBeCloseTo(10, 1);
  });

  it('throws when neither type nor bestFit is provided', () => {
    expect(() => createRegressionSeries({ data: linearData })).toThrow();
  });

  it('throws when both type and bestFit are provided', () => {
    expect(() =>
      createRegressionSeries({ data: linearData, type: 'linear', bestFit: true })
    ).toThrow();
  });
});

describe('findBestRegression', () => {
  it('selects a fit with high r2 for clean linear data', () => {
    const best = findBestRegression(linearData.map((d) => [d.time, d.value]));
    expect(best.r2).toBeGreaterThan(0.99);
  });
});

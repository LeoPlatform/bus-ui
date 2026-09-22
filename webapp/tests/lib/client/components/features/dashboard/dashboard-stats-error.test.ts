import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardState } from '$lib/client/components/features/dashboard/dashboard.state.svelte';
import { TimePickerState } from '$lib/client/components/features/time-picker/time-picker.state.svelte';
import { StatsRange } from '$lib/types';

function okStats(dashStats: unknown) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => ({ dashStats }) };
}

describe('DashboardState stats failures', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let dashboard: DashboardState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock = vi.fn();
    dashboard = new DashboardState(fetchMock as unknown as typeof globalThis.fetch);
    dashboard.id = 'bot:satori-attempt-emitter';
  });

  it('starts with no error', () => {
    expect(dashboard.statsError).toBeNull();
  });

  it('flags a non-ok response and keeps the last good stats', async () => {
    fetchMock.mockResolvedValueOnce(okStats({ buckets: ['good'] }));
    await dashboard.getDashStats();

    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await dashboard.getDashStats();

    expect(dashboard.statsError).toBeTruthy();
    expect(dashboard.stats).toEqual({ buckets: ['good'] });
  });

  it('flags a thrown fetch and keeps the last good stats', async () => {
    fetchMock.mockResolvedValueOnce(okStats({ buckets: ['good'] }));
    await dashboard.getDashStats();

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await dashboard.getDashStats();

    expect(dashboard.statsError).toBeTruthy();
    expect(dashboard.stats).toEqual({ buckets: ['good'] });
  });

  it('clears the flag on the next successful load', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await dashboard.getDashStats();
    expect(dashboard.statsError).toBeTruthy();

    fetchMock.mockResolvedValueOnce(okStats({ buckets: ['fresh'] }));
    await dashboard.getDashStats();

    expect(dashboard.statsError).toBeNull();
    expect(dashboard.stats).toEqual({ buckets: ['fresh'] });
  });

  it('issues one request per range change however often the picker is wired up', async () => {
    const picker = new TimePickerState(vi.fn() as unknown as typeof globalThis.fetch);
    fetchMock.mockResolvedValue(okStats({ buckets: [] }));

    dashboard.setTimePickerState(picker);
    dashboard.setTimePickerState(picker);
    fetchMock.mockClear();

    picker.range = StatsRange.Hour;
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).range).toBe(StatsRange.Hour);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimePickerState } from '$lib/client/components/features/time-picker/time-picker.state.svelte';
import { StatsRange } from '$lib/types';

const mockFetch = vi.fn();

describe('TimePickerState subscription contract', () => {
  let picker: TimePickerState;

  beforeEach(() => {
    vi.clearAllMocks();
    picker = new TimePickerState(mockFetch);
  });

  it('notifies every subscriber on a range change', () => {
    const first = vi.fn();
    const second = vi.fn();

    picker.onTimeRangeChange(first);
    picker.onTimeRangeChange(second);

    picker.range = StatsRange.Hour;

    expect(first).toHaveBeenCalledWith(picker);
    expect(second).toHaveBeenCalledWith(picker);
  });

  it('leaves the other subscribers armed when one unsubscribes', () => {
    const staying = vi.fn();
    const leaving = vi.fn();

    picker.onTimeRangeChange(staying);
    const unsubscribeLeaving = picker.onTimeRangeChange(leaving);

    unsubscribeLeaving();
    picker.range = StatsRange.Hour;

    expect(staying).toHaveBeenCalledTimes(1);
    expect(leaving).not.toHaveBeenCalled();
  });

  it('treats a repeated unsubscribe as a no-op', () => {
    const staying = vi.fn();
    const leaving = vi.fn();

    picker.onTimeRangeChange(staying);
    const unsubscribeLeaving = picker.onTimeRangeChange(leaving);

    unsubscribeLeaving();
    unsubscribeLeaving();
    picker.range = StatsRange.Hour;

    expect(staying).toHaveBeenCalledTimes(1);
    expect(leaving).not.toHaveBeenCalled();
  });

  it('notifies a subscriber once per change even when it registers twice', () => {
    const subscriber = vi.fn();

    picker.onTimeRangeChange(subscriber);
    picker.onTimeRangeChange(subscriber);

    picker.range = StatsRange.Hour;

    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  // Svelte mounts the incoming page before destroying the outgoing one, so the tree's
  // teardown lands after the dashboard has already re-registered.
  it('keeps the dashboard armed when a later-torn-down tree overlapped it', () => {
    const dashboard = vi.fn();
    const tree = vi.fn();

    picker.onTimeRangeChange(dashboard);
    const unsubscribeTree = picker.onTimeRangeChange(tree);

    const unsubscribeDashboard = picker.onTimeRangeChange(dashboard);
    unsubscribeTree();

    picker.range = StatsRange.Hour;

    expect(dashboard).toHaveBeenCalledTimes(1);
    expect(tree).not.toHaveBeenCalled();

    unsubscribeDashboard();
    picker.range = StatsRange.Day;

    expect(dashboard).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers for every path that publishes a change', () => {
    const subscriber = vi.fn();
    picker.onTimeRangeChange(subscriber);

    picker.range = StatsRange.Hour;
    picker.nextDateRange();
    picker.prevDateRange();
    picker.bucketToNow();
    picker.submitDateChanges();

    expect(subscriber).toHaveBeenCalledTimes(5);
  });
});

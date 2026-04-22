import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimePickerState } from '$lib/client/components/features/time-picker/time-picker.state.svelte';
import { StatsRange } from '$lib/types';

// Mock fetch function
const mockFetch = vi.fn();

describe('TimePickerState', () => {
  let timePickerState: TimePickerState;

  beforeEach(() => {
    vi.clearAllMocks();
    timePickerState = new TimePickerState(mockFetch);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(timePickerState.range).toBe(StatsRange.Minute15);
      expect(timePickerState.count).toBe(1);
      expect(timePickerState.isExpanded).toBe(false);
      expect(timePickerState.dateSelectorExpanded).toBe(false);
      expect(typeof timePickerState.customTime).toBe('string');
      expect(timePickerState.startTime).toBeLessThanOrEqual(Date.now());
      expect(timePickerState.endTime).toBeUndefined();
    });
  });

  describe('range property', () => {
    it('should get the current range', () => {
      expect(timePickerState.range).toBe(StatsRange.Minute15);
    });

    it('should set the range', () => {
      timePickerState.range = StatsRange.Hour;
      expect(timePickerState.range).toBe(StatsRange.Hour);
    });

    it('should handle all valid range values', () => {
      const ranges = [
        StatsRange.Minute15,
        StatsRange.Hour,
        StatsRange.Hour6,
        StatsRange.Day,
        StatsRange.Week
      ];

      ranges.forEach(range => {
        timePickerState.range = range;
        expect(timePickerState.range).toBe(range);
      });
    });
  });

  describe('count property', () => {
    it('should get the current count', () => {
      expect(timePickerState.count).toBe(1);
    });
  });

  describe('customTime property', () => {
    it('should get current custom time', () => {
      expect(typeof timePickerState.customTime).toBe('string');
    });

    it('should set custom time', () => {
      const newTime = '14:30';
      timePickerState.customTime = newTime;
      expect(timePickerState.customTime).toBe(newTime);
    });
  });

  describe('isExpanded property', () => {
    it('should get and set expanded state', () => {
      expect(timePickerState.isExpanded).toBe(false);
      
      timePickerState.isExpanded = true;
      expect(timePickerState.isExpanded).toBe(true);
      
      timePickerState.isExpanded = false;
      expect(timePickerState.isExpanded).toBe(false);
    });
  });

  describe('dateSelectorExpanded property', () => {
    it('should get and set date selector expanded state', () => {
      expect(timePickerState.dateSelectorExpanded).toBe(false);
      
      timePickerState.dateSelectorExpanded = true;
      expect(timePickerState.dateSelectorExpanded).toBe(true);
      
      timePickerState.dateSelectorExpanded = false;
      expect(timePickerState.dateSelectorExpanded).toBe(false);
    });
  });

  describe('timeRangeString property', () => {
    it('should return formatted time range string', () => {
      const timeRangeString = timePickerState.timeRangeString;
      expect(typeof timeRangeString).toBe('string');
      expect(timeRangeString).toContain(' - ');
    });
  });

  describe('submitDateChanges', () => {
    it('should close date selector', () => {
      timePickerState.dateSelectorExpanded = true;
      timePickerState.submitDateChanges();
      expect(timePickerState.dateSelectorExpanded).toBe(false);
    });
  });

  describe('callback management', () => {
    it('should set and clear time range change callback', () => {
      const mockCallback = vi.fn();
      
      timePickerState.setOnTimeRangeChangeCallback(mockCallback);
      timePickerState.clearOnTimeRangeChangeCallback();
      
      // Should not throw error when callback is cleared
      expect(() => timePickerState.range = StatsRange.Hour).not.toThrow();
    });

    it('should call callback when time range changes', () => {
      const mockCallback = vi.fn();
      timePickerState.setOnTimeRangeChangeCallback(mockCallback);

      timePickerState.range = StatsRange.Hour;

      expect(mockCallback).toHaveBeenCalledWith(timePickerState);
    });
  });

  describe('createStatsQueryRequest', () => {
    it('should create valid stats query request', () => {
      const nodeIds = ['node1', 'node2'];
      const request = timePickerState.createStatsQueryRequest(nodeIds);

      expect(request).toEqual({
        range: timePickerState.rangeData.period as StatsRange,
        count: timePickerState.rangeData.count,
        startTime: timePickerState.startTime,
        endTime: timePickerState.endTime,
        nodeIds: nodeIds
      });
    });

    it('should handle empty node ids array', () => {
      const request = timePickerState.createStatsQueryRequest([]);
      expect(request.nodeIds).toEqual([]);
    });
  });

  describe('minifyStatsRange', () => {
    it('should return correct minified strings for all ranges', () => {
      const testCases = [
        { range: StatsRange.Minute, expected: '1m' },
        { range: StatsRange.Minute1, expected: '1m' },
        { range: StatsRange.Minute15, expected: '15m' },
        { range: StatsRange.Hour, expected: '1h' },
        { range: StatsRange.Hour6, expected: '6h' },
        { range: StatsRange.Day, expected: '1d' },
        { range: StatsRange.Week, expected: '1w' }
      ];

      testCases.forEach(({ range, expected }) => {
        expect(timePickerState.minifyStatsRange(range)).toBe(expected);
      });
    });

    it('should use current range when no parameter provided', () => {
      timePickerState.range = StatsRange.Hour;
      expect(timePickerState.minifyStatsRange()).toBe('1h');
    });

    it('should throw error for invalid range', () => {
      expect(() => {
        timePickerState.minifyStatsRange('invalid' as StatsRange);
      }).toThrow('Unable to minify a non-existent range');
    });
  });

  describe('getAvailableRanges', () => {
    it('should return all available ranges', () => {
      const ranges = timePickerState.getAvailableRanges();

      expect(ranges).toHaveLength(5);
      expect(ranges).toEqual([
        { value: StatsRange.Minute15, label: "15 minutes", short: "15m" },
        { value: StatsRange.Hour, label: "1 hour", short: "1hr" },
        { value: StatsRange.Hour6, label: "6 hours", short: "6hr" },
        { value: StatsRange.Day, label: "1 day", short: "1d" },
        { value: StatsRange.Week, label: "1 week", short: "1w" }
      ]);
    });
  });

  describe('formatDisplayTime', () => {
    it('should format timestamp correctly', () => {
      const timestamp = Date.now();
      const formatted = timePickerState.formatDisplayTime(timestamp);

      expect(typeof formatted).toBe('string');
      expect(formatted).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}$/);
    });

    it('should handle zero timestamp', () => {
      const formatted = timePickerState.formatDisplayTime(0);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatTimeRange', () => {
    it('should format time range with end time', () => {
      const formatted = timePickerState.formatTimeRange();
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain(' - ');
    });
  });

  describe('edge cases', () => {
    it('should handle callback being undefined', () => {
      // Should not throw when no callback is set
      expect(() => {
        timePickerState.range = StatsRange.Hour;
      }).not.toThrow();
    });

    it('should handle multiple range changes', () => {
      const mockCallback = vi.fn();
      timePickerState.setOnTimeRangeChangeCallback(mockCallback);

      timePickerState.range = StatsRange.Hour;
      timePickerState.range = StatsRange.Day;
      timePickerState.range = StatsRange.Week;

      expect(mockCallback).toHaveBeenCalledTimes(3);
    });
  });

  describe('hour_6 range functionality', () => {
    beforeEach(() => {
      // Set a fixed start time that aligns with 6-hour boundaries for consistent testing
      const fixedTime = new Date('2025-01-15T06:00:00Z').getTime();
      timePickerState.startTime = fixedTime;
    });

    it('should set hour_6 range correctly', () => {
      timePickerState.range = StatsRange.Hour6;
      expect(timePickerState.range).toBe(StatsRange.Hour6);
    });

    it('should create correct stats query request for hour_6', () => {
      timePickerState.range = StatsRange.Hour6;
      const nodeIds = ['node1', 'node2'];
      const request = timePickerState.createStatsQueryRequest(nodeIds);

      // For hour_6, the rangeData.period is 'hour' and count is 6
      expect(request.range).toBe('hour');
      expect(request.count).toBe(6);
      expect(request.nodeIds).toEqual(nodeIds);
    });

    it('should navigate to next 6-hour period correctly', () => {
      timePickerState.range = StatsRange.Hour6;
      const initialStartTime = timePickerState.startTime;
      
      timePickerState.nextDateRange();
      
      // Should advance by 6 hours
      const expectedNextTime = initialStartTime + (6 * 60 * 60 * 1000);
      expect(timePickerState.startTime).toBe(expectedNextTime);
    });

    it('should navigate to previous 6-hour period correctly', () => {
      timePickerState.range = StatsRange.Hour6;
      const initialStartTime = timePickerState.startTime;
      
      timePickerState.prevDateRange();
      
      // Should go back by 6 hours
      const expectedPrevTime = initialStartTime - (6 * 60 * 60 * 1000);
      expect(timePickerState.startTime).toBe(expectedPrevTime);
    });

    it('should update time range correctly when switching to hour_6', () => {
      const initialStartTime = timePickerState.startTime;
      
      timePickerState.range = StatsRange.Hour6;
      
      // The start time should be aligned to the 6-hour boundary
      expect(timePickerState.startTime).toBeLessThanOrEqual(initialStartTime);
      expect(timePickerState.endTime).toBeDefined();
      
      // End time should be 6 hours after start time
      const expectedEndTime = timePickerState.startTime + (6 * 60 * 60 * 1000);
      expect(timePickerState.endTime).toBe(expectedEndTime);
    });

    it('should maintain 6-hour increments when navigating multiple times', () => {
      timePickerState.range = StatsRange.Hour6;
      const initialStartTime = timePickerState.startTime;
      
      // Navigate forward twice
      timePickerState.nextDateRange();
      timePickerState.nextDateRange();
      
      // Should advance by 12 hours total (2 * 6 hours)
      const expectedTime = initialStartTime + (12 * 60 * 60 * 1000);
      expect(timePickerState.startTime).toBe(expectedTime);
      
      // Navigate backward once
      timePickerState.prevDateRange();
      
      // Should be back to 6 hours from initial
      const expectedBackTime = initialStartTime + (6 * 60 * 60 * 1000);
      expect(timePickerState.startTime).toBe(expectedBackTime);
    });

    it('should not affect other ranges when switching from hour_6', () => {
      // Start with hour_6
      timePickerState.range = StatsRange.Hour6;
      const hour6StartTime = timePickerState.startTime;
      const hour6EndTime = timePickerState.endTime;
      
      // Switch to hour
      timePickerState.range = StatsRange.Hour;
      const hourStartTime = timePickerState.startTime;
      const hourEndTime = timePickerState.endTime;
      
      // Switch to day
      timePickerState.range = StatsRange.Day;
      const dayStartTime = timePickerState.startTime;
      const dayEndTime = timePickerState.endTime;
      
      // Each should have appropriate time ranges for their duration
      // hour_6 should have 6-hour duration
      expect(hour6EndTime).toBe(hour6StartTime + (6 * 60 * 60 * 1000));
      
      // hour should have 1-hour duration
      expect(hourEndTime).toBe(hourStartTime + (1 * 60 * 60 * 1000));
      
      // day should have 24-hour duration
      expect(dayEndTime).toBe(dayStartTime + (24 * 60 * 60 * 1000));
    });

    it('should handle hour_6 navigation with end time set', () => {
      timePickerState.range = StatsRange.Hour6;
      const initialStartTime = timePickerState.startTime;
      const initialEndTime = timePickerState.endTime;
      
      timePickerState.nextDateRange();
      
      // Both start and end times should advance by 6 hours
      expect(timePickerState.startTime).toBe(initialStartTime + (6 * 60 * 60 * 1000));
      expect(timePickerState.endTime).toBeDefined();
      if (initialEndTime) {
        expect(timePickerState.endTime).toBe(initialEndTime + (6 * 60 * 60 * 1000));
      }
    });

    it('should align to 6-hour boundaries correctly', () => {
      // Set a time that's not aligned to 6-hour boundaries
      const unalignedTime = new Date('2025-01-15T11:30:00Z').getTime();
      timePickerState.startTime = unalignedTime;
      
      timePickerState.range = StatsRange.Hour6;
      
      // Should align to the nearest 6-hour boundary
      const alignedTime = timePickerState.startTime;
      const alignedDate = new Date(alignedTime);
      const hour = alignedDate.getUTCHours();
      
      // Should be aligned to 0, 6, 12, or 18 hours
      expect([0, 6, 12, 18]).toContain(hour);
      
      // The aligned time should be before or equal to the original time
      expect(alignedTime).toBeLessThanOrEqual(unalignedTime);
      
      // The end time should be 6 hours after the start time
      expect(timePickerState.endTime).toBe(alignedTime + (6 * 60 * 60 * 1000));
    });
  });
}); 
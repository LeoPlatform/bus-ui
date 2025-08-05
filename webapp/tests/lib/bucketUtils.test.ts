import { describe, it, expect } from 'vitest';
import { getStartAndEndOfBucket, bucketsData, type BucketData } from '../../src/lib/bucketUtils';

describe('getStartAndEndOfBucket', () => {
  // Helper function to create a fixed date for consistent testing
  const createTestDate = (year: number, month: number, day: number, hour: number, minute: number = 0) => {
    return new Date(Date.UTC(year, month - 1, day, hour, minute)).getTime();
  };

  describe('minute_1 bucket', () => {
    const bucket = bucketsData.minute_1;

    it('should return correct start and end for a specific minute', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 30); // 2024-01-15 14:30:00 UTC
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 30);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 31);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should use current time when no time parameter is provided', () => {
      const beforeCall = Date.now();
      const result = getStartAndEndOfBucket(bucket);
      const afterCall = Date.now();

      // The function should use current time when no parameter is provided
      // The result will be aligned to the start of the current minute
      expect(result.start).toBeLessThanOrEqual(afterCall + 60000); // Should be within 1 minute of current time
      expect(result.end).toBe(result.start + 60000); // 1 minute in milliseconds
      expect(result.start).toBeLessThan(result.end); // Start should be before end
    });

    it('should handle edge case at minute boundary', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 0); // Start of hour
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 0);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 1);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });
  });

  describe('minute_5 bucket', () => {
    const bucket = bucketsData.minute_5;

    it('should align to 5-minute boundaries', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 32); // 14:32
      const result = getStartAndEndOfBucket(bucket, testTime);

      // Should align to the previous 5-minute boundary (14:30)
      const expectedStart = createTestDate(2024, 1, 15, 14, 30);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 35);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle exact 5-minute boundary', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 30); // Exact 5-minute boundary
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 30);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 35);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle time just before 5-minute boundary', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 29); // Just before 14:30
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 25);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 30);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });
  });

  describe('minute_15 bucket', () => {
    const bucket = bucketsData.minute_15;

    it('should align to 15-minute boundaries', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 37); // 14:37
      const result = getStartAndEndOfBucket(bucket, testTime);

      // Should align to the previous 15-minute boundary (14:30)
      const expectedStart = createTestDate(2024, 1, 15, 14, 30);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 45);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle exact 15-minute boundary', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 30); // Exact 15-minute boundary
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 30);
      const expectedEnd = createTestDate(2024, 1, 15, 14, 45);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });
  });

  describe('hour bucket', () => {
    const bucket = bucketsData.hour;

    it('should return correct start and end for a specific hour', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 30); // 14:30
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 0); // Start of hour
      const expectedEnd = createTestDate(2024, 1, 15, 15, 0); // Start of next hour

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle time at minute 59', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 59); // 14:59
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 14, 0);
      const expectedEnd = createTestDate(2024, 1, 15, 15, 0);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });
  });

  describe('day bucket', () => {
    const bucket = bucketsData.day;

    it('should return correct start and end for a specific day', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 30); // 2024-01-15 14:30
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 0, 0); // Start of day
      const expectedEnd = createTestDate(2024, 1, 16, 0, 0); // Start of next day

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle time at 23:59', () => {
      const testTime = createTestDate(2024, 1, 15, 23, 59); // 23:59
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 15, 0, 0);
      const expectedEnd = createTestDate(2024, 1, 16, 0, 0);

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });
  });

  describe('week bucket', () => {
    const bucket = bucketsData.week;

    it('should return correct start and end for a specific week', () => {
      // 2024-01-15 is a Monday
      const testTime = createTestDate(2024, 1, 15, 14, 30); // Monday 14:30
      const result = getStartAndEndOfBucket(bucket, testTime);

      // Week starts on Sunday (2024-01-14), so Monday (2024-01-15) is in the week starting Sunday
      const expectedStart = createTestDate(2024, 1, 14, 0, 0); // Start of Sunday (week start)
      const expectedEnd = createTestDate(2024, 1, 21, 0, 0); // Start of next Sunday

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle time on Sunday', () => {
      // 2024-01-14 is a Sunday
      const testTime = createTestDate(2024, 1, 14, 23, 59); // Sunday 23:59
      const result = getStartAndEndOfBucket(bucket, testTime);

      const expectedStart = createTestDate(2024, 1, 14, 0, 0); // Start of Sunday (week start)
      const expectedEnd = createTestDate(2024, 1, 21, 0, 0); // Start of next Sunday

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });
  });

  describe('edge cases', () => {
    it('should handle zero timestamp', () => {
      const bucket = bucketsData.minute_1;
      const result = getStartAndEndOfBucket(bucket, 0);

      // Unix epoch start (1970-01-01 00:00:00 UTC)
      // The function should use the provided timestamp (0) instead of current time
      const expectedStart = 0;
      const expectedEnd = 60000; // 1 minute later

      expect(result.start).toBe(expectedStart);
      expect(result.end).toBe(expectedEnd);
    });

    it('should handle large timestamp', () => {
      const bucket = bucketsData.hour;
      const largeTimestamp = 9999999999999; // Far future date
      const result = getStartAndEndOfBucket(bucket, largeTimestamp);

      expect(result.start).toBeLessThan(result.end);
      expect(result.end - result.start).toBe(3600000); // 1 hour in milliseconds
    });

    it('should handle negative timestamp', () => {
      const bucket = bucketsData.day;
      const negativeTimestamp = -1000000; // Past date
      const result = getStartAndEndOfBucket(bucket, negativeTimestamp);

      expect(result.start).toBeLessThan(result.end);
      expect(result.end - result.start).toBe(86400000); // 1 day in milliseconds
    });
  });

  describe('function behavior', () => {
    it('should always return start < end', () => {
      const bucket = bucketsData.minute_1;
      const testTime = createTestDate(2024, 1, 15, 14, 30);
      const result = getStartAndEndOfBucket(bucket, testTime);

      expect(result.start).toBeLessThan(result.end);
    });

    it('should return timestamps as numbers', () => {
      const bucket = bucketsData.hour;
      const testTime = createTestDate(2024, 1, 15, 14, 30);
      const result = getStartAndEndOfBucket(bucket, testTime);

      expect(typeof result.start).toBe('number');
      expect(typeof result.end).toBe('number');
    });

    it('should handle all bucket types consistently', () => {
      const testTime = createTestDate(2024, 1, 15, 14, 30);
      
      Object.values(bucketsData).forEach(bucket => {
        const result = getStartAndEndOfBucket(bucket, testTime);
        
        expect(result).toHaveProperty('start');
        expect(result).toHaveProperty('end');
        expect(result.start).toBeLessThan(result.end);
        expect(typeof result.start).toBe('number');
        expect(typeof result.end).toBe('number');
      });
    });
  });
}); 
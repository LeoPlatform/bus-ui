// Type definitions
export interface Duration {
  m?: number;
  h?: number;
  d?: number;
  w?: number;
}

export interface BucketData {
  period: string;
  prefix: string;
  transform: (timestamp: Date) => string;
  value: (timestamp: Date) => Date;
  prev: (timestamp: Date, amount?: number) => Date;
  next: (timestamp: Date, amount?: number) => Date;
  parent: string | null;
  duration: Duration;
  defaultContainer: string;
  defaultContainerInterval: number;
}

export interface RangeData {
  period: string;
  count: number;
  startOf: (timestamp: Date) => Date;
  rolling?: {
    period: string;
    count: number;
  };
}

export type BucketsData = Record<string, BucketData>;
export type RangesData = Record<string, RangeData>;

// Utility functions for date manipulation
class DateUtils {
  static toUTC(date: Date): Date {
    //BUG: not sure if we want to use the timezone offset or not here
    // return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return new Date(date.getTime());
  }

  static startOfMinute(date: Date): Date {
    const utcDate = this.toUTC(date);
    return new Date(Date.UTC(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours(),
      utcDate.getUTCMinutes()
    ));
  }

  static startOfHour(date: Date): Date {
    const utcDate = this.toUTC(date);
    return new Date(Date.UTC(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      utcDate.getUTCHours()
    ));
  }

  static startOfDay(date: Date): Date {
    const utcDate = this.toUTC(date);
    return new Date(Date.UTC(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate()
    ));
  }

  static startOfWeek(date: Date): Date {
    const utcDate = this.toUTC(date);
    const dayOfWeek = utcDate.getUTCDay();
    const startOfWeek = new Date(utcDate);
    startOfWeek.setUTCDate(utcDate.getUTCDate() - dayOfWeek);
    return this.startOfDay(startOfWeek);
  }

  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  static addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 3600000);
  }

  static addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000);
  }

  static addWeeks(date: Date, weeks: number): Date {
    return this.addDays(date, weeks * 7);
  }

  static subtractMinutes(date: Date, minutes: number): Date {
    return this.addMinutes(date, -minutes);
  }

  static subtractHours(date: Date, hours: number): Date {
    return this.addHours(date, -hours);
  }

  static subtractDays(date: Date, days: number): Date {
    return this.addDays(date, -days);
  }

  static subtractWeeks(date: Date, weeks: number): Date {
    return this.addWeeks(date, -weeks);
  }

  static formatDate(date: Date, format: string): string {
    const utcDate = this.toUTC(date);
    const year = utcDate.getUTCFullYear();
    const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getUTCDate()).padStart(2, '0');
    const hours = String(utcDate.getUTCHours()).padStart(2, '0');
    const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes);
  }
}

// Buckets data configuration
export const bucketsData: BucketsData = {
  minute_1: {
    period: 'minute',
    prefix: 'minute_',
    transform: (timestamp: Date): string => {
      const startOf = DateUtils.startOfMinute(timestamp);
      return `minute_${DateUtils.formatDate(startOf, 'YYYY-MM-DD HH:mm')}`;
    },
    value: (timestamp: Date): Date => {
      return DateUtils.startOfMinute(timestamp);
    },
    prev: (timestamp: Date, amount = 1): Date => {
      return DateUtils.subtractMinutes(DateUtils.toUTC(timestamp), amount);
    },
    next: (timestamp: Date, amount = 1): Date => {
      return DateUtils.addMinutes(DateUtils.toUTC(timestamp), amount);
    },
    parent: 'minute_5',
    duration: { m: 1 },
    defaultContainer: 'minute',
    defaultContainerInterval: 6 * 5
  },

  minute_5: {
    period: 'minute_5',
    prefix: 'minute_5_',
    transform: (timestamp: Date): string => {
      const utcDate = DateUtils.toUTC(timestamp);
      const offset = (utcDate.getUTCMinutes() + 5) % 5;
      const aligned = DateUtils.subtractMinutes(utcDate, offset);
      const startOf = DateUtils.startOfMinute(aligned);
      return `minute_5_${DateUtils.formatDate(startOf, 'YYYY-MM-DD HH:mm')}`;
    },
    value: (timestamp: Date): Date => {
      const utcDate = DateUtils.toUTC(timestamp);
      const offset = (utcDate.getUTCMinutes() + 5) % 5;
      const aligned = DateUtils.subtractMinutes(utcDate, offset);
      return DateUtils.startOfMinute(aligned);
    },
    prev: (timestamp: Date, amount = 1): Date => {
      return DateUtils.subtractMinutes(DateUtils.toUTC(timestamp), 5 * amount);
    },
    next: (timestamp: Date, amount = 1): Date => {
      return DateUtils.addMinutes(DateUtils.toUTC(timestamp), 5 * amount);
    },
    parent: 'minute_15',
    duration: { m: 5 },
    defaultContainer: 'minute',
    defaultContainerInterval: 6 * 15
  },

  minute_15: {
    period: 'minute_15',
    prefix: 'minute_15_',
    transform: (timestamp: Date): string => {
      const utcDate = DateUtils.toUTC(timestamp);
      const offset = (utcDate.getUTCMinutes() + 15) % 15;
      const aligned = DateUtils.subtractMinutes(utcDate, offset);
      const startOf = DateUtils.startOfMinute(aligned);
      return `minute_15_${DateUtils.formatDate(startOf, 'YYYY-MM-DD HH:mm')}`;
    },
    value: (timestamp: Date): Date => {
      const utcDate = DateUtils.toUTC(timestamp);
      const offset = (utcDate.getUTCMinutes() + 15) % 15;
      const aligned = DateUtils.subtractMinutes(utcDate, offset);
      return DateUtils.startOfMinute(aligned);
    },
    prev: (timestamp: Date, amount = 1): Date => {
      return DateUtils.subtractMinutes(DateUtils.toUTC(timestamp), 15 * amount);
    },
    next: (timestamp: Date, amount = 1): Date => {
      return DateUtils.addMinutes(DateUtils.toUTC(timestamp), 15 * amount);
    },
    parent: 'hour',
    duration: { m: 15 },
    defaultContainer: 'hour',
    defaultContainerInterval: 6
  },

  hour: {
    period: 'hour',
    prefix: 'hour_',
    transform: (timestamp: Date): string => {
      const startOf = DateUtils.startOfHour(timestamp);
      return `hour_${DateUtils.formatDate(startOf, 'YYYY-MM-DD HH')}`;
    },
    value: (timestamp: Date): Date => {
      return DateUtils.startOfHour(timestamp);
    },
    prev: (timestamp: Date, amount = 1): Date => {
      return DateUtils.subtractHours(DateUtils.toUTC(timestamp), amount);
    },
    next: (timestamp: Date, amount = 1): Date => {
      return DateUtils.addHours(DateUtils.toUTC(timestamp), amount);
    },
    parent: 'day',
    duration: { h: 1 },
    defaultContainer: 'hour',
    defaultContainerInterval: 30
  },

  day: {
    period: 'day',
    prefix: 'day_',
    transform: (timestamp: Date): string => {
      const startOf = DateUtils.startOfDay(timestamp);
      return `day_${DateUtils.formatDate(startOf, 'YYYY-MM-DD')}`;
    },
    value: (timestamp: Date): Date => {
      return DateUtils.startOfDay(timestamp);
    },
    prev: (timestamp: Date, amount = 1): Date => {
      return DateUtils.subtractDays(DateUtils.toUTC(timestamp), amount);
    },
    next: (timestamp: Date, amount = 1): Date => {
      return DateUtils.addDays(DateUtils.toUTC(timestamp), amount);
    },
    parent: 'week',
    duration: { d: 1 },
    defaultContainer: 'day',
    defaultContainerInterval: 30
  },

  week: {
    period: 'week',
    prefix: 'week_',
    transform: (timestamp: Date): string => {
      const startOf = DateUtils.startOfWeek(timestamp);
      return `week_${DateUtils.formatDate(startOf, 'YYYY-MM-DD')}`;
    },
    value: (timestamp: Date): Date => {
      return DateUtils.startOfWeek(timestamp);
    },
    prev: (timestamp: Date, amount = 1): Date => {
      return DateUtils.subtractWeeks(DateUtils.toUTC(timestamp), amount);
    },
    next: (timestamp: Date, amount = 1): Date => {
      return DateUtils.addWeeks(DateUtils.toUTC(timestamp), amount);
    },
    parent: null,
    duration: { w: 1 },
    defaultContainer: 'week',
    defaultContainerInterval: 30
  }
};

// Ranges configuration
export const ranges: RangesData = {
  minute: {
    period: 'minute_1',
    count: 1,
    startOf: (timestamp: Date) => DateUtils.startOfMinute(timestamp)
  },

  minute_1: {
    period: 'minute_1',
    count: 1,
    startOf: (timestamp: Date) => DateUtils.startOfMinute(timestamp)
  },

  minute_5: {
    period: 'minute_1',
    count: 5,
    startOf: (timestamp: Date) => {
      const utcDate = DateUtils.toUTC(timestamp);
      const offset = (utcDate.getUTCMinutes() + 5) % 5;
      const aligned = DateUtils.subtractMinutes(utcDate, offset);
      return DateUtils.startOfMinute(aligned);
    }
  },

  minute_15: {
    period: 'minute_1',
    count: 15,
    startOf: (timestamp: Date) => {
      const offset = (timestamp.getMinutes() + 15) % 15;
      const aligned = DateUtils.subtractMinutes(timestamp, offset);
      return DateUtils.startOfMinute(aligned);
    }
  },

  hour: {
    period: 'hour',
    count: 1,
    startOf: (timestamp: Date) => DateUtils.startOfHour(timestamp),
    rolling: {
      period: 'minute_15',
      count: 4
    }
  },

  hour_6: {
    period: 'hour',
    count: 6,
    startOf: (timestamp: Date) => DateUtils.startOfHour(timestamp)
  },

  day: {
    period: 'hour',
    count: 24,
    startOf: (timestamp: Date) => DateUtils.startOfDay(timestamp)
  },

  week: {
    period: 'hour',
    count: 168,
    startOf: (timestamp: Date) => DateUtils.startOfWeek(timestamp)
  }
};

// Helper function to get bucket (implementing the commented-out function from original)
export interface BucketResult {
  prefix: string;
  transform: (timestamp: Date) => string;
  prev: (timestamp: Date, amount?: number) => Date;
  next: (timestamp: Date, amount?: number) => Date;
  duration: number; // Duration in milliseconds
}

export function getBucket(period: string | RangeData): BucketResult | null {
  const range = typeof period === 'string' ? ranges[period] : period;
  
  if (!range || !bucketsData[range.period]) {
    return null;
  }

  const bucket = bucketsData[range.period];

  // Calculate duration in milliseconds
  let durationMs = 0;
  if (bucket.duration.m) durationMs += bucket.duration.m * 60 * 1000;
  if (bucket.duration.h) durationMs += bucket.duration.h * 60 * 60 * 1000;
  if (bucket.duration.d) durationMs += bucket.duration.d * 24 * 60 * 60 * 1000;
  if (bucket.duration.w) durationMs += bucket.duration.w * 7 * 24 * 60 * 60 * 1000;
  
  durationMs *= range.count;

  return {
    prefix: bucket.prefix,
    transform: (timestamp: Date) => bucket.transform(timestamp),
    prev: (timestamp: Date, amount = 1) => bucket.prev(timestamp, amount * range.count),
    next: (timestamp: Date, amount = 1) => bucket.next(timestamp, amount * range.count),
    duration: durationMs
  };
}

// Export the main data structures
export const statsBuckets = {
  data: bucketsData,
  ranges: ranges,
  getBucket: getBucket
};

// Default export for convenience
export default statsBuckets;
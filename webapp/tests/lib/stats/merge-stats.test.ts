import { describe, it, expect } from 'vitest';
import { marshall } from '@aws-sdk/util-dynamodb';
import type { QueryOutput } from '@aws-sdk/client-dynamodb';
import { mergeStatsResults } from '$lib/stats/utils';

/**
 * Regression tests for mergeStatsResults (ES-4034, workflow "0 / N/A" defect).
 *
 * Two production bugs lived here:
 *  1. A LeoStats record with no `read` (write-only bot) or no `write` key threw
 *     `Object.entries(undefined)`, 500ing /api/workflow/stats and blanking EVERY
 *     edge label on the workflow view. Legacy guards this (lib/stats.js `|| {}`).
 *  2. New queue entries were assigned the SAME shared default object, so every
 *     queue of a bot aliased one record and reported identical summed stats.
 */

function asQuery(records: object[]): QueryOutput {
  return { Items: records.map((r) => marshall(r)) } as QueryOutput;
}

const execStat = (errors: number, units = 100) => ({
  completions: units - errors,
  duration: 50,
  errors,
  max_duration: 10,
  min_duration: 1,
  units,
});

const rwStat = (units: number, timestamp = 1756100000000) => ({
  checkpoint: 'z/2026/08/25/16/00/00/',
  source_timestamp: timestamp,
  timestamp,
  units,
});

describe('mergeStatsResults', () => {
  it('does not throw for a write-only record (no `read` key)', () => {
    const merged = mergeStatsResults(
      asQuery([
        { id: 'bot:writer', bucket: 'b1', current: { execution: execStat(0), write: { 'queue:out': rwStat(10) } } },
      ])
    );
    expect(merged.write!['queue:out'].units).toBe(10);
    expect(merged.read).toEqual({});
  });

  it('does not throw for a read-only record (no `write` key)', () => {
    const merged = mergeStatsResults(
      asQuery([
        { id: 'bot:reader', bucket: 'b1', current: { execution: execStat(0), read: { 'queue:in': rwStat(4) } } },
      ])
    );
    expect(merged.read!['queue:in'].units).toBe(4);
    expect(merged.write).toEqual({});
  });

  it('keeps per-queue stats independent (no shared default aliasing)', () => {
    const merged = mergeStatsResults(
      asQuery([
        {
          id: 'bot:fanout',
          bucket: 'b1',
          current: {
            write: { 'queue:a': rwStat(5, 1000), 'queue:b': rwStat(7, 2000) },
          },
        },
      ])
    );
    expect(merged.write!['queue:a'].units).toBe(5);
    expect(merged.write!['queue:b'].units).toBe(7);
    expect(merged.write!['queue:a'].timestamp).toBe(1000);
    expect(merged.write!['queue:b'].timestamp).toBe(2000);
    expect(merged.write!['queue:a']).not.toBe(merged.write!['queue:b']);
  });

  it('sums units and execution errors across buckets and keeps the max timestamp', () => {
    const merged = mergeStatsResults(
      asQuery([
        { id: 'bot:x', bucket: 'b1', current: { execution: execStat(3), read: { 'queue:in': rwStat(10, 1000) } } },
        { id: 'bot:x', bucket: 'b2', current: { execution: execStat(4), read: { 'queue:in': rwStat(20, 3000) } } },
      ])
    );
    expect(merged.execution?.errors).toBe(7);
    expect(merged.read!['queue:in'].units).toBe(30);
    expect(merged.read!['queue:in'].timestamp).toBe(3000);
  });
});

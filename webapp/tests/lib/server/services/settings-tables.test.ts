import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Which DynamoDB table each settings path targets (ES-4286).
 *
 * `getSettings` routed every `system:` id to the queue path, which reads LeoEvent, while
 * `saveSystemSettings` writes LeoSystem. No real system has a LeoEvent row, so the read threw
 * every time; the error was swallowed and the form kept the previously viewed node's values,
 * which Save then wrote over the real record — blanking its label, icon and system type.
 *
 * The read/write pair addressing one table is the contract here, and it is invisible at
 * runtime until an operator clicks Save on a real system. These tests assert the table by
 * name so the pair cannot silently drift apart again.
 */

const sent: any[] = [];

vi.mock('$env/dynamic/private', () => ({
  env: {
    LEO_CRON_TABLE: 'TestBus-LeoCron',
    LEO_EVENT_TABLE: 'TestBus-LeoEvent',
    LEO_STATS_TABLE: 'TestBus-LeoStats',
    LEO_SYSTEM_TABLE: 'TestBus-LeoSystem'
  }
}));

vi.mock('$lib/server/aws_utils', () => ({
  createDynamoClient: () => ({})
}));

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  class GetCommand {
    constructor(public input: any) {}
  }
  class PutCommand {
    constructor(public input: any) {}
  }
  class ScanCommand {
    constructor(public input: any) {}
  }
  return {
    GetCommand,
    PutCommand,
    ScanCommand,
    DynamoDBDocumentClient: {
      from: () => ({
        send: async (cmd: any) => {
          sent.push({ type: cmd.constructor.name, ...cmd.input });
          // Every table answers with a plausible item so the code under test proceeds far
          // enough to reveal which table it asked.
          return { Item: { id: 'hubspot', event: 'hubspot', label: 'hubspot', icon: 'https://example/icon.png', settings: { system: 'hubspot' } } };
        }
      })
    }
  };
});

const { getSettings, saveSystemSettings } = await import('$lib/server/services/dynamoService');

const creds = {} as any;

beforeEach(() => {
  sent.length = 0;
});

describe('getSettings — table routing', () => {
  it('reads a system: id from LeoSystem, never from LeoEvent', async () => {
    await getSettings(creds, 'system:hubspot');
    const tables = sent.map((s) => s.TableName);
    expect(tables).toContain('TestBus-LeoSystem');
    expect(tables).not.toContain('TestBus-LeoEvent');
  });

  it('keys the system read by `id`, the attribute LeoSystem is keyed on', async () => {
    await getSettings(creds, 'system:hubspot');
    const read = sent.find((s) => s.TableName === 'TestBus-LeoSystem');
    expect(read.Key).toEqual({ id: 'hubspot' });
  });

  it('still reads a queue: id from LeoEvent', async () => {
    await getSettings(creds, 'queue:some.queue');
    const tables = sent.map((s) => s.TableName);
    expect(tables).toContain('TestBus-LeoEvent');
    expect(tables).not.toContain('TestBus-LeoSystem');
  });

  it('still reads a bot id from LeoCron', async () => {
    await getSettings(creds, 'my-bot');
    expect(sent.map((s) => s.TableName)).toContain('TestBus-LeoCron');
  });
});

describe('saveSystemSettings — writes the table it read', () => {
  it('reads and writes LeoSystem', async () => {
    await saveSystemSettings(creds, 'system:hubspot', { label: 'hubspot' });
    const tables = new Set(sent.map((s) => s.TableName));
    expect(tables).toEqual(new Set(['TestBus-LeoSystem']));
  });

  it('leaves an existing icon alone when the update omits it', async () => {
    await saveSystemSettings(creds, 'system:hubspot', { label: 'renamed' });
    const put = sent.find((s) => s.type === 'PutCommand');
    expect(put.Item.icon).toBe('https://example/icon.png');
    expect(put.Item.label).toBe('renamed');
  });

  it('does not write null over an existing icon', async () => {
    // The form sends `icon: null` for an empty input. Blanking a record because a field was
    // left empty is the destructive half of this bug, so a null icon is treated as "no
    // change" rather than "clear it".
    await saveSystemSettings(creds, 'system:hubspot', { label: 'hubspot', icon: null });
    const put = sent.find((s) => s.type === 'PutCommand');
    expect(put.Item.icon).toBe('https://example/icon.png');
  });
});

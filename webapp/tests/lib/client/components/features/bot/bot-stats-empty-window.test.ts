import { describe, it, expect } from 'vitest';
import { BotState } from '$lib/client/components/features/bot/bot.state.svelte';
import { TimePickerState } from '$lib/client/components/features/time-picker/time-picker.state.svelte';

function respond(stats: unknown[]) {
  return async (..._args: unknown[]) => ({ ok: true, json: async () => ({ stats }) }) as Response;
}

function botStateWith(responses: Array<ReturnType<typeof respond>>) {
  const calls = [...responses];
  const fetch = (async (...args: Parameters<typeof globalThis.fetch>) => calls.shift()!(...args)) as typeof globalThis.fetch;
  const botState = new BotState(fetch);
  botState.setTimePickerState(new TimePickerState(fetch));
  botState.visibleIds = ['bot:a', 'queue:q'];
  return botState;
}

describe('fetchBotStats when a window has no activity', () => {
  it('drops the previous stats for nodes the server returns nothing for', async () => {
    const botState = botStateWith([
      respond([{ id: 'bot:a', writes: 5 }, { id: 'queue:q', writes: 7 }]),
      respond([{ id: '' }]),
    ]);

    await botState.fetchBotStats();
    expect(botState.stats.map((s) => s.id)).toEqual(['bot:a', 'queue:q']);

    botState.clearStatsCache();
    await botState.fetchBotStats();

    expect(botState.stats.find((s) => s.id === 'bot:a')).toBeUndefined();
    expect(botState.stats.find((s) => s.id === 'queue:q')).toBeUndefined();
  });

  it('replaces returned nodes and drops only the ones that went quiet', async () => {
    const botState = botStateWith([
      respond([{ id: 'bot:a', writes: 5 }, { id: 'queue:q', writes: 7 }]),
      respond([{ id: 'queue:q', writes: 9 }]),
    ]);

    await botState.fetchBotStats();
    botState.clearStatsCache();
    await botState.fetchBotStats();

    expect(botState.stats.find((s) => s.id === 'bot:a')).toBeUndefined();
    expect((botState.stats.find((s) => s.id === 'queue:q') as any).writes).toBe(9);
  });

  it('keeps previous stats when the request fails', async () => {
    const failing = async () => ({ ok: false, status: 500, statusText: 'err' }) as Response;
    const botState = botStateWith([respond([{ id: 'bot:a', writes: 5 }]), failing]);

    await botState.fetchBotStats();
    botState.clearStatsCache();
    await botState.fetchBotStats();

    expect(botState.stats.map((s) => s.id)).toEqual(['bot:a']);
  });
});

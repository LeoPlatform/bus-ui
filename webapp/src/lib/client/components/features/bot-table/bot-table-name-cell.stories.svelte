<!--
  One story per mock-bot preset, each computing status through the same evaluateBotStatus
  the app uses. The `play` functions run as browser tests (Storybook vitest project) and
  assert the status ring the cell paints on the icon <img>.
-->
<script module lang="ts">
  import { defineMeta, setTemplate, type Args } from '@storybook/addon-svelte-csf';
  import { expect } from '@storybook/test';
  import NameCell from './bot-table-name-cell.svelte';
  import StoryAppState from '$lib/testing/story-appstate.svelte';
  import { evaluateBotStatus } from '$comps/features/bot/bot-status.utils';
  import {
    mockHealthy,
    mockRogue,
    mockRoguePaused,
    mockPaused,
    mockArchivedRogue,
    mockBlocked,
    mockDanger,
    mockCheckpoint,
    mockStatsFor,
  } from '$lib/testing/mock-bots';
  import type { ComponentProps } from 'svelte';
  import type { BotSettings } from '$lib/types';

  const { Story } = defineMeta({
    title: 'Botmon/BotTableNameCell',
    component: NameCell,
  });

  /** Build the cell args for a preset, deriving status the way the real table does. */
  function cellArgs(preset: BotSettings) {
    return {
      id: preset.id,
      name: preset.name ?? preset.id,
      tags: preset.tags,
      kind: 'bot' as const,
      status: evaluateBotStatus(preset, mockStatsFor(preset.id)).status,
    };
  }

  /** Return the icon <img>'s class attribute, failing the test if it's missing. */
  async function imgClass(canvasElement: HTMLElement): Promise<string> {
    const img = canvasElement.querySelector('img');
    await expect(img).toBeTruthy();
    return img?.getAttribute('class') ?? '';
  }

  const RING_TOKENS = ['ring-red-500', 'ring-amber-500', 'ring-gray-500', 'opacity-60', 'opacity-40'];
</script>

<script lang="ts">
  // Must be in the instance script: setTemplate references the markup snippet below.
  setTemplate(template);
</script>

{#snippet template(args: Args<typeof Story>)}
  <StoryAppState>
    <NameCell {...(args as ComponentProps<typeof NameCell>)} />
  </StoryAppState>
{/snippet}

<Story
  name="Healthy"
  args={cellArgs(mockHealthy())}
  play={async ({ canvasElement }) => {
    const cls = await imgClass(canvasElement);
    for (const token of RING_TOKENS) expect(cls).not.toContain(token);
  }}
/>

<Story
  name="Rogue"
  args={cellArgs(mockRogue())}
  play={async ({ canvasElement }) => {
    expect(await imgClass(canvasElement)).toContain('ring-red-500');
  }}
/>

<Story
  name="RoguePaused"
  args={cellArgs(mockRoguePaused())}
  play={async ({ canvasElement }) => {
    // Rogue wins over paused → red ring, not the gray paused ring.
    expect(await imgClass(canvasElement)).toContain('ring-red-500');
  }}
/>

<Story
  name="Paused"
  args={cellArgs(mockPaused())}
  play={async ({ canvasElement }) => {
    const cls = await imgClass(canvasElement);
    expect(cls).toContain('ring-gray-500');
    expect(cls).toContain('opacity-60');
  }}
/>

<Story
  name="ArchivedRogue"
  args={cellArgs(mockArchivedRogue())}
  play={async ({ canvasElement }) => {
    // Archived wins over rogue → dimmed, no ring.
    expect(await imgClass(canvasElement)).toContain('opacity-40');
  }}
/>

<Story
  name="Blocked"
  args={cellArgs(mockBlocked())}
  play={async ({ canvasElement }) => {
    expect(await imgClass(canvasElement)).toContain('ring-red-500');
  }}
/>

<Story
  name="Danger"
  args={cellArgs(mockDanger())}
  play={async ({ canvasElement }) => {
    expect(await imgClass(canvasElement)).toContain('ring-amber-500');
  }}
/>

<Story
  name="Checkpoint"
  args={cellArgs(mockCheckpoint())}
  play={async ({ canvasElement }) => {
    // Checkpoint bot is healthy/running → no status ring.
    const cls = await imgClass(canvasElement);
    for (const token of RING_TOKENS) expect(cls).not.toContain(token);
  }}
/>

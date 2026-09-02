<!--
  The dashboard header renders the read checkpoint through CopyButton, and saving a new one
  changes that value in place — so the displayed text must follow a value that changes after
  mount.

  The `play` functions run as browser tests via the Storybook vitest project.
-->
<script module lang="ts">
  import { defineMeta, setTemplate, type Args } from '@storybook/addon-svelte-csf';
  import { expect } from '@storybook/test';
  import CopyButtonHarness from '$lib/testing/copy-button-harness.svelte';
  import type { ComponentProps } from 'svelte';

  const { Story } = defineMeta({
    title: 'Botmon/CopyButton',
    component: CopyButtonHarness,
  });

  const OLD_TOKEN = 'z/2023/04/26/16/59/1682528369063-0000000';
  const NEW_TOKEN = 'z/2026/08/17/18/30/00/';

  /** The visible (non-hidden) text CopyButton paints. */
  function shownText(canvasElement: HTMLElement): string {
    const span = canvasElement.querySelector('span.font-mono');
    return (span?.textContent ?? '').trim();
  }

  /**
   * Poll the visible text until it equals `expected`, then assert. Polling rather than a fixed
   * tick keeps the passing case non-flaky (the value arrives asynchronously) while still failing
   * on the regression — a value that never updates simply exhausts the budget.
   */
  async function expectText(canvasElement: HTMLElement, expected: string): Promise<void> {
    const deadline = Date.now() + 1500;
    while (shownText(canvasElement) !== expected && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    await expect(shownText(canvasElement)).toBe(expected);
  }

  async function clickSwap(canvasElement: HTMLElement): Promise<void> {
    const button = canvasElement.querySelector('[data-testid="swap"]') as HTMLButtonElement | null;
    await expect(button).toBeTruthy();
    button!.click();
  }
</script>

<script lang="ts">
  setTemplate(template);
</script>

{#snippet template(args: Args<typeof Story>)}
  <CopyButtonHarness {...(args as ComponentProps<typeof CopyButtonHarness>)} />
{/snippet}

<Story
  name="Shows the initial value"
  args={{ first: OLD_TOKEN, second: NEW_TOKEN }}
  play={async ({ canvasElement }) => {
    await expectText(canvasElement, OLD_TOKEN);
  }}
/>

<Story
  name="Follows the value when it changes after mount"
  args={{ first: OLD_TOKEN, second: NEW_TOKEN }}
  play={async ({ canvasElement }) => {
    await expectText(canvasElement, OLD_TOKEN);
    await clickSwap(canvasElement);
    // The regression: this stayed on OLD_TOKEN, which is why the dashboard header kept
    // showing the pre-save checkpoint until the page was reloaded.
    await expectText(canvasElement, NEW_TOKEN);
  }}
/>

<Story
  name="Truncates, and re-truncates the new value"
  args={{ first: OLD_TOKEN, second: NEW_TOKEN, truncate: true, maxLength: 25 }}
  play={async ({ canvasElement }) => {
    // OLD_TOKEN is 40 chars, so it truncates; NEW_TOKEN is 22, so it comes through whole.
    // Both halves matter: truncation has to be recomputed for the new value, not carried over.
    await expectText(canvasElement, OLD_TOKEN.substring(0, 25) + '...');
    await clickSwap(canvasElement);
    await expectText(canvasElement, NEW_TOKEN);
  }}
/>

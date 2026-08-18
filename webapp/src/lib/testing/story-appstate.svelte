<!--
  story-appstate — minimal AppState context provider for Storybook.

  bot-table-name-cell.svelte reads `getContext("appState")` and calls navigation methods on
  click. Stories don't have the real AppState, so this harness supplies a no-op stub and
  renders its children beneath it. Wrap state stories with this (via setTemplate) so the
  component mounts without throwing.
-->
<script lang="ts">
  import { setContext, type Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // No-op stand-in for AppState — the name cell only calls these two methods on click.
  setContext('appState', {
    navigateToDashboardView() {},
    navigateToRelationshipView() {},
  });
</script>

{@render children()}

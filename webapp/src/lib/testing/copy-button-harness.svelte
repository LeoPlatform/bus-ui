<!--
  Test-only harness for copy-button.svelte.

  CopyButton is rendered with a value that changes after mount, which is exactly what the
  dashboard header does when a checkpoint is saved. The button swaps the value so a story's
  `play` function can assert that the displayed text follows it.
-->
<script lang="ts">
    import CopyButton from '$comps/copy-button.svelte';

    type HarnessProps = {
        /** Value rendered on mount. */
        first: string;
        /** Value swapped in when the button is clicked. */
        second: string;
        truncate?: boolean;
        maxLength?: number;
    };

    let { first, second, truncate = false, maxLength = 30 }: HarnessProps = $props();

    let value = $state(first);
</script>

<div>
    <button data-testid="swap" onclick={() => (value = second)}>swap</button>
    <CopyButton {truncate} {maxLength} {value} />
</div>

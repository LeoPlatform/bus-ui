<!--
  CopyButton — renders a value as monospace text with a copy-to-clipboard affordance.

  The value is taken as a plain `value` prop rather than as a snippet whose rendered text is
  scraped out of a hidden element. The scrape version could not react to its own content: the
  extraction ran inside an $effect whose only dependency was the `children` snippet reference,
  which is stable across updates, so the text was captured once on mount. Any caller whose value
  changed in place — the dashboard header after a checkpoint save (ES-3461 issue 2) — kept
  displaying the mount-time value until a full page reload.
-->
<script lang="ts">
    import { Check, Copy } from "@lucide/svelte";
    import { Button } from "$ui/button";

    type CopyButtonProps = {
        /** Text to display and to place on the clipboard. Reactive — updates in place. */
        value: string | undefined;
        truncate?: boolean;
        maxLength?: number;
    }

    let {value, truncate = false, maxLength = 30}: CopyButtonProps = $props();

    let displayValue: string | undefined = $derived.by(() => {
        if (!value) return undefined;
        if (truncate && value.length > maxLength) {
            return value.substring(0, maxLength) + '...';
        }
        return value;
    });
    let showCheckmark = $state(false);

    function copy() {
        if (!value) {
            console.error('No value to copy');
            return;
        }

        if (!navigator || !navigator.clipboard) {
            console.error('Clipboard API not supported');
            return;
        }

        try {
            navigator.clipboard.writeText(value);
            showCheckmark = true;
            setTimeout(() => {
                showCheckmark = false;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy value:', err);
            showCheckmark = false;
        }
    }

</script>

<span class="inline-flex w-fit items-center gap-1">
    <span class="text-sm font-mono text-muted-foreground" title={truncate ? value : undefined}>{displayValue}</span>
    <span class="w-6 h-6 flex items-center justify-center">
        {#if showCheckmark}
            <Check class="w-3.5 h-3.5 text-green-500" />
        {:else}
            <Button variant="ghost" class="h-full w-full min-h-0 p-0 rounded-none hover:bg-transparent" onclick={copy} disabled={!value}>
                <Copy class="w-3.5 h-3.5 text-gray-400 hover:text-foreground transition-colors" />
            </Button>
        {/if}
    </span>
</span>

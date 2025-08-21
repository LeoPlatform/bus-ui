<script lang="ts">
    import { Check, Copy } from "@lucide/svelte";
    import { Button } from "$ui/button";
    import { tick, type Snippet } from "svelte";

    type CopyButtonProps = {
        children?: Snippet<[]>;
    }

    let {children}: CopyButtonProps = $props();

    let hiddenRef: HTMLElement;
    let value: string | undefined = $state(undefined);
    let showCheckmark = $state(false);

    $effect(() => {
        if (children) {
            extractText().catch((e) => {
                throw new Error(
                    `Failed to extract value: ${e instanceof Error ? e.message + ' ' + e.stack : String(e)}`
                );
            });
        }
    });

    async function extractText() {
        await tick();
        if(hiddenRef) {
            value = (hiddenRef.textContent || '').trim();
        }

        if(!value) {
            throw new Error('Did not find any text in the hidden container of ValueToCopy');
        }
    }

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

<pre
    class="hidden-container"
    bind:this={hiddenRef}
    style="display: none; position: absolute; left: -9999px;">{#if children}{@render children()}{/if}</pre>

    <span class="inline-flex w-fit items-center">
        <span>{value}</span>
        <span class="w-6 h-6 flex items-center justify-center">
            {#if showCheckmark}
                <Check class="w-3.5 h-3.5 text-green-500" />
            {:else}
                <Button variant="ghost" class="h-full w-full min-h-0 p-0 rounded-none hover:bg-transparent" onclick={copy} disabled={!value}>
                    <Copy class="w-3.5 h-3.5 text-gray-400" />
                </Button>
            {/if}
        </span>
    </span>
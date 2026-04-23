<script lang="ts">
    import * as Tooltip from '$lib/client/components/ui/tooltip/index';
    import Info from '@lucide/svelte/icons/info';
    import HelpCircle from '@lucide/svelte/icons/help-circle';

    interface Props {
        helpText: string;
        help?: boolean;
        info?: boolean;
        side?: 'top' | 'bottom' | 'left' | 'right';
    }

    const { helpText, help, info, side = 'right' }: Props = $props();
</script>

<div class="relative">
    <Tooltip.Provider>
        <Tooltip.Root delayDuration={100}>
            <Tooltip.Trigger>
                {#if help}
                    <HelpCircle class="w-4 h-4"/>
                {:else if info}
                    <Info class="w-4 h-4"/>
                {:else}
                    <HelpCircle class="w-4 h-4"/>
                {/if}
            </Tooltip.Trigger>
            <Tooltip.Content side={side} class="flex items-center gap-4 bg-slate-600 text-white max-w-xs">
                <span class="font-medium break-words">{helpText}</span>
            </Tooltip.Content>
        </Tooltip.Root>
    </Tooltip.Provider>
</div>
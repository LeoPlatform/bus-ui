<script lang="ts">
    import type { Snippet } from 'svelte';

    type SplitPaneProps = {
        open?: boolean;
        defaultWidth?: number;
        minWidth?: number;
        maxWidth?: number;
        /**
         * When true the right pane uses `sticky top-4 self-start` so it pins
         * while the left side scrolls (trace-lineage style).
         * When false (default) both panes fill the container height and scroll
         * independently.
         */
        stickyRight?: boolean;
        left: Snippet;
        right: Snippet;
    };

    let {
        open = true,
        defaultWidth = 288,
        minWidth = 200,
        maxWidth = 600,
        stickyRight = false,
        left,
        right,
    }: SplitPaneProps = $props();

    let panelWidth = $state(defaultWidth);

    function onHandlePointerDown(e: PointerEvent) {
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startW = panelWidth;

        function onMove(ev: PointerEvent) {
            // Dragging left widens the panel (handle is on its left edge).
            const delta = startX - ev.clientX;
            panelWidth = Math.min(maxWidth, Math.max(minWidth, startW + delta));
        }
        function onUp() {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
        }
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
    }
</script>

<div class="flex min-h-0 flex-1 gap-3">
    <div class="min-w-0 flex-1 {stickyRight ? '' : 'overflow-y-auto'}">
        {@render left()}
    </div>

    {#if open}
        <div
            class="w-1.5 shrink-0 cursor-col-resize self-stretch rounded-full bg-border transition-colors hover:bg-muted-foreground/40 active:bg-muted-foreground/60"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            onpointerdown={onHandlePointerDown}
        ></div>

        {#if stickyRight}
            <div class="sticky top-4 flex shrink-0 self-start" style="width: {panelWidth}px">
                {@render right()}
            </div>
        {:else}
            <div class="shrink-0 min-h-0 overflow-y-auto" style="width: {panelWidth}px">
                {@render right()}
            </div>
        {/if}
    {/if}
</div>

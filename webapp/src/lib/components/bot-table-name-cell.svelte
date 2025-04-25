<script lang="ts">
    import ListTree from '@lucide/svelte/icons/list-tree';
  import Button from './ui/button/button.svelte';
    type CellProps = {
        id: string,
        tags?: string,
        idLinkClicked: (id: string) => void;
    }

    let {id, tags, idLinkClicked}: CellProps = $props();
    let tagsArr = tags?.split(',') ?? [];


</script>

<div class="flex-row">
    <div class="flex justify-between">
        <div class="flex">
            <svg class="w-11 h-11 float-left pr-1">
                <image class="w-full h-full" xlink:href="/bot.png"/>
            </svg>
            <div >{id}</div>
        </div>
        <Button variant="ghost" onclick={() => idLinkClicked(id)}>
            <ListTree />
        </Button>

    </div>
    {#if tagsArr}
        <div class="flex flex-wrap px-10">
            {#each tagsArr as tag}
                <span class="ml-2 px-2 border rounded-sm bg-slate-200" >{tag}</span>
            {/each}
        </div>
    {/if}
</div>
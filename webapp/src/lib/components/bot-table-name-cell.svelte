<script lang="ts">
    import ListTree from '@lucide/svelte/icons/list-tree';
  import Button from './ui/button/button.svelte';
    type CellProps = {
        id: string,
        tags?: string,
        idLinkClicked: (id: string) => void;
    }

    let {id, tags, idLinkClicked}: CellProps = $props();
    let tagsArr = tags?.split(',').filter(tag => tag !== '') ?? [];
    let selectedBotId: string | undefined = $state(undefined);

    function selectBot(id: string) {
        selectedBotId = id
    }


</script>

<div class="flex-row">
    <div class="flex justify-between">
        <div class="flex items-center">
            <Button variant="ghost" class="p-1 w-11 h-11" onclick={() => selectBot(id)}>
                <img src="/bot.png" alt="Bot" class="w-full h-full object-contain" />
            </Button>
            <div class="ml-2">{id}</div>
        </div>
        <Button variant="ghost" onclick={() => idLinkClicked(id)}>
            <ListTree />
        </Button>

    </div>
    {#if tagsArr}
        <div class="flex flex-wrap px-10">
            {#each tagsArr as tag}
                <span class="ml-2 mb-1 px-2 border rounded-sm bg-slate-200" >{tag}</span>
            {/each}
        </div>
    {/if}
</div>
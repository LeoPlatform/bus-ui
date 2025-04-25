<script lang="ts">
    import BotTable from "$lib/components/bot-table.svelte";
    // import { columns } from "$lib/botTableColumn";
  import { goto } from "$app/navigation";

    let { data } = $props();
    const {botData} = data;

    async function goToWorkflow(id: string) {
        console.log('going to workflow', id);
        await goto(`/workflows/${id}`);
    }

    // console.log("[")
</script>

<BotTable data={botData} goToWorkflow={goToWorkflow} />
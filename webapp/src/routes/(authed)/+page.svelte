<script lang="ts">
    import BotTable from "$lib/components/bot-table.svelte";
    // import { columns } from "$lib/botTableColumn";
  import { goto } from "$app/navigation";
  import * as Dialog from "$lib/components/ui/dialog";

    let { data } = $props();
    const {botData} = data;

    let selectedNodeId: string | undefined = $state(undefined);
    let showDashboard: boolean = $state(false);

    async function goToWorkflow(id: string) {
        console.log('going to workflow', id);
        await goto(`/workflows/${id}`);
    }

    function toggleDashboard(id: string) {
        selectedNodeId = id;
        showDashboard = true;
    }

    // console.log("[")
</script>

<BotTable data={botData} goToWorkflow={goToWorkflow}/>


<!-- DASHBOARD LOGIC -->
<Dialog.Root bind:open={showDashboard}>
  <Dialog.Content class="max-w-[90vw] max-h-[90vh] w-full h-full p-0 overflow-hidden flex items-center justify-center">
    {#if selectedNodeId}
       
    {/if}
</Dialog.Content>
    <!-- <Dialog.Trigger>
        <button>Open</button>
    </Dialog.Trigger>
    <Dialog.Content>
        <Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
        <Dialog.Description>This action cannot be undone. This will permanently delete your account and remove your data from our servers.</Dialog.Description>
        <Dialog.Close>Cancel</Dialog.Close>
        <Dialog.Action>Yes, delete account</Dialog.Action>
    </Dialog.Content> -->
</Dialog.Root>

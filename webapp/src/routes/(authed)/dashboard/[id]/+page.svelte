<script lang="ts">
  import UnderConstruction from '$lib/client/components/under-construction.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
</script>

<UnderConstruction title="Dashboard" />

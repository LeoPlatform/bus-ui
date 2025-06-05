<script lang="ts">
    import { setContext, type Snippet } from 'svelte';
    import type { LayoutData } from './$types';
  import type { AppState } from '$lib/client/appstate.svelte';

    interface Props {
        data: {
            appState: AppState;
        },
        children: any;
    };

    let {children, data}: Props = $props();

    const appState = data.appState;

    setContext('appState', appState);

</script>

{@render children()}

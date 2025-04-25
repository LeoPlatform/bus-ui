<script lang="ts">
  import type { RelationshipTree } from "$lib/types";
  import { onMount } from "svelte";

    // import * as d3 from 'd3';
    type DoubleTreeProps = {
        relationship: RelationshipTree
        node_width?: number
        stroke_color?: string
    };

    let {relationship, node_width, stroke_color}: DoubleTreeProps = $props();

    if(!node_width) {
        node_width = 75;
    }

    if(!stroke_color) {
        stroke_color = "#50ADE5";
    }

    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = 1500 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    onMount(() => {
        
    })

</script>
<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
  import type { DashboardStats, RelationshipTree, TreeNode } from "$lib/types";
  import { humanize } from "$lib/utils";
  import { error } from "@sveltejs/kit";
  import * as d3 from "d3";
  import { getContext, onMount, untrack } from "svelte";
  import { DEFAULT_FILTER_OPTIONS, type FilterOptions, type LinkStats } from "./types";
  import { createGoodIdentifier, findOriginalData, getOriginalNodeId, getRelationshipSummary, handleBackgroundNodeCircles, initializeLinkStats, processTree, processTreeSimple, processTreeVerySimple, processTreeWithImportanceFiltering, toggleNodeExpansion } from "./tree-utils.svelte";
  import { createLucideIconComponent, createLucideIconFromComponent, createNodeLabel, createTreeLayout, setupZoomBehavior } from "./d3-utils.svelte";
  import { generateSmartCurve } from "./link-utils.svelte";
  import RelationshipFilterControls from "./relationship-filter-controls.svelte";
  import Filter from '@lucide/svelte/icons/filter';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import ChartDetailsPane from "../chart-details-pane/chart-details-pane.svelte";

  let appState = getContext<AppState>('appState');
    appState.botState.buildRelationShipTree();
  let relationShipTree = appState.botState.relationShipTree;
  let botStats = $derived(appState.botState.stats || []);

  let {
    // relationShipTree,
    // stats,
    nodeWidth,
    strokeColor,
  }: { 
    // relationShipTree: RelationshipTree;
    // stats: MergedStatsRecord[];
    nodeWidth?: number;
    strokeColor?: string;
  } = $props();

  if (!nodeWidth) nodeWidth = 75;
  if (!strokeColor) strokeColor = "#50ADE5";

  let expandedNodes = $state(new Set<string>());
  let currentNodeCount = $derived(appState.botState.visibleIds.length);

  //TODO: will need to also track status, errors
  let linkStats: Map<string, LinkStats> = $state(new Map());

  let svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  let zoomHandler: d3.ZoomBehavior<Element, unknown>;
  let linkGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  let nodeGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  let nodePositions = new Map<string, { x: number; y: number }>(); // Track node positions
  let lastExpandedNode: string | null = null; // Track which node was last expanded

  let containerElement: HTMLElement;
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  let relationshipFilters = $state(new Map<string, FilterOptions>());
  let activeFilterControls = $state(new Set<string>());
  let filterDrawerOpen = $state(false);
  let currentFilterKey = $state<string | null>(null);
  
  // Link selection and charts state
  let selectedLink = $state<{ sourceId: string; targetId: string; direction: 'read' | 'write' } | null>(null);
  let dashboardStats = $state<DashboardStats | null>(null);
  let chartsVisible = $state(false);
  let chartsLoading = $state(false);
  
  // Make range reactive to time picker state changes
  let currentRange = $derived(appState.timePickerState?.range || 'minute15');

  let nodesNeedingFilters = $derived.by(() => {
    if (!relationShipTree) return new Set<string>();
    
    const needsFilters = new Set<string>();
    
    function checkNode(node: RelationshipTree) {
      // Check if this node has many children or parents
      if (node.children && node.children.length > 10) {
        needsFilters.add(`${node.id}-children`);
      }
      if (node.parents && node.parents.length > 10) {
        needsFilters.add(`${node.id}-parents`);
      }
      
      // Recursively check children and parents
      node.children?.forEach(child => checkNode(child));
      node.parents?.forEach(parent => checkNode(parent));
    }
    
    checkNode(relationShipTree);
    return needsFilters;
  });

   // Function to handle time range changes
  async function handleTimeRangeChange() {
    // console.log('Bot relationship tree: Time range changed, fetching new stats');
    untrack(async () => {
      // Clear the fetched stats cache in bot state to force refresh
      appState.botState.clearStatsCache?.();
      
      // Fetch new stats with current visible nodes
      if (appState.botState.visibleIds.length > 0) {
        await appState.botState.fetchBotStats();
        if(selectedLink && chartsVisible) {
          // Ensure we wait for the time picker state to be updated
          await new Promise(resolve => setTimeout(resolve, 0));
          if(selectedLink.sourceId.startsWith('queue:') || selectedLink.sourceId.startsWith('system:')) {
            dashboardStats = await appState.botState.fetchDashboardStats('bot:' + selectedLink.targetId);
          } else if(selectedLink.targetId.startsWith('queue:') || selectedLink.targetId.startsWith('system:')) {
            dashboardStats = await appState.botState.fetchDashboardStats('bot:' + selectedLink.sourceId);
          }
        }
        initializeLinkStats(botStats, linkStats);
        renderVisualization();
      }
    });
  }

  onMount(() => {

    containerElement = document.getElementById('tree-container')!;
    updateContainerDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateContainerDimensions();
      if (svg) {
        renderVisualization(); // Re-render when container resizes
      }
    });
  
    resizeObserver.observe(containerElement);

    const handleWindowResize = () => {
      updateContainerDimensions();
      if (svg) {
        renderVisualization();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    
    const treeData = relationShipTree;


    if (!treeData) {
      error(500, "failed to generate tree data");
      return;
    }

    appState.timePickerState.setOnTimeRangeChangeCallback(handleTimeRangeChange);


    initializeVisualization();
    initializeLinkStats(botStats, linkStats);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      appState.timePickerState.clearOnTimeRangeChangeCallback();
    };
    
  })

  $effect(() => {
    if (!filterDrawerOpen) {
      currentFilterKey = null;
    }
  });

function updateContainerDimensions() {
  if (containerElement) {
    // Get the parent container's dimensions
    const parentElement = containerElement.parentElement;
    if (parentElement) {
      const parentRect = parentElement.getBoundingClientRect();
      containerWidth = parentRect.width;
      containerHeight = parentRect.height;
    } else {
      // Fallback to container's own dimensions
      const rect = containerElement.getBoundingClientRect();
      containerWidth = rect.width || window.innerWidth;
      containerHeight = rect.height || window.innerHeight;
    }
  }
}

  $effect(() => {

    const shouldRefresh = appState.botState.refreshOnTime;
    const staleTime = appState.botState.staleTime;

    if(!shouldRefresh) return;

    let isActive = true;

    const timer = setInterval(() => {
      if(!isActive || !shouldRefresh) {
        console.log('timer is cancelled - auto refresh no longer active');
      }

      untrack(async () => {
        try {
          // console.log(`${staleTime / 1000} seconds elapsed - refreshing stats data`);
          if(selectedLink && chartsVisible) {
            // Only update dashboard stats if we have a valid selection and charts are visible
            const newDashboardStats = selectedLink.sourceId.startsWith('queue:') || selectedLink.sourceId.startsWith('system:') 
              ? await appState.botState.fetchDashboardStats('bot:' + selectedLink.targetId)
              : await appState.botState.fetchDashboardStats('bot:' + selectedLink.sourceId);
            
            // Only update if the stats actually changed
            if (JSON.stringify(newDashboardStats) !== JSON.stringify(dashboardStats)) {
              dashboardStats = newDashboardStats;
            }
          }
          await appState.botState.fetchBotStats();

          if(isActive) {
            initializeLinkStats(botStats, linkStats);
            renderVisualization();
          }
        } catch (error) {
          console.error('Error during auto-refresh:', error);
        }
      })
    }, staleTime);

    return () => {
      // console.log('Cleaning up auto-refresh timer');
      isActive = false;
      clearInterval(timer);
    }
  })

  $effect(() => {

    const count = currentNodeCount;

    if(count === 0) {
      return;
    }

    untrack( async () => {
      await appState.botState.fetchBotStats();
      initializeLinkStats(botStats, linkStats);
      renderVisualization();
    })
  })

  function initializeVisualization() {
    // Clear any existing SVG
    d3.select("#tree-container").selectAll("*").remove();
    // Set up SVG dimensions and margins
    //TODO: this needs to be updated to take in the full window size rather than a static value
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    // const width = containerWidth - margin.left - margin.right;
    // const height = containerHeight - margin.top - margin.bottom;

    // Create the SVG container
    svg = d3
      .select("#tree-container")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("max-width", "100%")
      .style("max-height", "100%")
      .append("g")
      .attr("transform", `translate(0, 0)`);

    // Create persistent groups for links and nodes
    linkGroup = svg.append("g").attr("class", "links");
    nodeGroup = svg.append("g").attr("class", "nodes");

    // Add zoom behavior
    zoomHandler = setupZoomBehavior(svg);

    // Set initial transform to maintain centering
    const initialTransform = d3.zoomIdentity.translate(containerWidth / 2, 0);

    d3.select("#tree-container svg").call(zoomHandler).call(zoomHandler.transform, initialTransform);

    renderVisualization();
  }

  function getLinkStats(parentId: string, childId: string): LinkStats {

    // console.log(linkStats);
    // Simply remove all prefixes
    const cleanParentId = parentId.replace(/^(bot:|queue:|system:)/, '');
    const cleanChildId = childId.replace(/^(bot:|queue:|system:)/, '');
    
    const key = `${cleanParentId}-${cleanChildId}`;

    // console.log('getLinkStats key: ', key);
    const linkStat = linkStats.get(key);
    
    if (linkStat) {
      return linkStat;
    }
    
    // Fallback logic (existing code for when no stats found)
    const botData = appState.botState.botSettings.find(bot => bot.id === cleanParentId || bot.id === cleanChildId);
    const type = botData?.id == cleanParentId ? 'write' : 'read';
    const endedTimestamp = botData?.checkpoints?.[type]?.[cleanChildId]?.ended_timestamp;
    
    return { eventCount: 0, lastWrite: endedTimestamp ?? Date.now(), linkType: type };
  }

  function isNodeExpanded(nodeId: string): boolean {
    return expandedNodes.has(nodeId);
  }

  function updateVisibleNodesFromDOM() {
    const visibleNodes = new Set<string>();

    // Get all nodes that are actually rendered and visible in the DOM
    nodeGroup.selectAll(".node").each(function (d: any) {
      const element = d3.select(this);
      const opacity = parseFloat(element.style("opacity")) || 1;

      // Only include nodes that are visible (opacity > 0)
      if (opacity > 0) {
        let id = d.data.originalId || d.data.id;
        // console.log('id: ', id);
        if (d.data.type == "bot") {
          id = `bot:${d.data.originalId || d.data.id}`;
        }
        visibleNodes.add(id);
      }
    });

    appState.botState.visibleIds = Array.from(visibleNodes);
  }



  function getLowerText(stat: LinkStats): string {
    if(Date.now() - stat.lastWrite == 0 && stat.eventCount == 0) {
      return 'N/A';
    } else if(stat.linkType === 'read') {
      if (Date.now() - stat.lastWrite < appState.botState.staleTime / 2) {
            return '-'
          } else {
            return 'lag:' + humanize(Date.now() - stat.lastWrite);
          }
    } else {
      return humanize(Date.now() - stat.lastWrite) + ' ago';
    }
  }

  function handleFilterChange(nodeId: string, direction: 'children' | 'parents', newOptions: FilterOptions) {
    const key = `${nodeId}-${direction}`;
    
    relationshipFilters.set(key, newOptions);
    relationshipFilters = new Map(relationshipFilters); // Trigger reactivity

    // Use untrack to prevent this update from triggering reactive loops
    untrack(() => {
      renderVisualization();
    });
  }

  // Also update your toggleFilterControls to be more robust:
function toggleFilterControls(nodeId: string, direction: 'children' | 'parents') {
  const key = `${nodeId}-${direction}`;
  
  // Always ensure the filter is active in our tracking
  if (!activeFilterControls.has(key)) {
    activeFilterControls.add(key);
    activeFilterControls = new Set(activeFilterControls);
  }
  
  // Initialize default filter options if they don't exist (only on first time)
  if (!relationshipFilters.has(key)) {
    relationshipFilters.set(key, { ...DEFAULT_FILTER_OPTIONS });
    relationshipFilters = new Map(relationshipFilters);
  }
  
  // Always open the drawer when button is clicked
  currentFilterKey = key;
  filterDrawerOpen = true;
}

  function renderVisualization() {
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Create separate trees for left and right directions
    const rightRoot = processTreeWithImportanceFiltering(
      relationShipTree, 
      "right", 
      expandedNodes,
      linkStats,
      relationshipFilters
    );
  
    const leftRoot = processTreeWithImportanceFiltering(
      relationShipTree, 
      "left", 
      expandedNodes,
      linkStats,
      relationshipFilters
    );
    

    const constrainedHeight = Math.min(height, containerHeight - margin.top - margin.bottom);

    // Create tree data structures
    const rightTreeResult = createTreeLayout(rightRoot, "right", constrainedHeight, nodeWidth!);
    const leftTreeResult = createTreeLayout(leftRoot, "left", constrainedHeight, nodeWidth!);
    const rightTree: d3.HierarchyPointNode<TreeNode> = rightTreeResult.treeData;
    const leftTree: d3.HierarchyPointNode<TreeNode> = leftTreeResult.treeData;

    // Use the maximum height from either tree
    const maxDynamicHeight = Math.max(
      rightTreeResult.dynamicHeight,
      leftTreeResult.dynamicHeight
    );

    const maxHeight = Math.max(
      maxDynamicHeight + margin.top + margin.bottom,
      containerHeight
    );

    d3.select("#tree-container svg").attr(
      "height",
      maxHeight
    );

    // Combine nodes from both trees
    const allNodes: d3.HierarchyPointNode<TreeNode>[] = [...rightTree.descendants(), ...leftTree.descendants()];
    // Combine links from both trees
    const allLinks = [...rightTree.links(), ...leftTree.links()];
    
    // Convert virtual links to direct links between actual nodes
    const actualLinks = convertVirtualLinksToActual(allLinks);
    // Filter out virtual nodes from rendering
    const actualNodes = allNodes.filter(node => !node.data.isVirtual);
    
    // Helper function to convert virtual links to direct links between actual nodes
    function convertVirtualLinksToActual(links: d3.HierarchyPointLink<TreeNode>[]): d3.HierarchyPointLink<TreeNode>[] {
      const result: d3.HierarchyPointLink<TreeNode>[] = [];
      
      for (const link of links) {
        const source = link.source;
        const target = link.target;
        
        // If source is virtual, find its actual parent
        let actualSource = source;
        while (actualSource.data.isVirtual && actualSource.parent) {
          actualSource = actualSource.parent;
        }
        
        // If target is virtual, find its actual child
        let actualTarget = target;
        if (actualTarget.data.isVirtual && actualTarget.children && actualTarget.children.length > 0) {
          actualTarget = actualTarget.children[0];
        }
        
        // Only add link if both nodes are actual (not virtual)
        if (!actualSource.data.isVirtual && !actualTarget.data.isVirtual) {
          result.push({
            source: actualSource,
            target: actualTarget
          });
        }
      }
      
      return result;
    }

    // Helper function to create unique position key including direction
    function getPositionKey(
      nodeId: string,
      direction: string,
      depth: number
    ): string {
      return `${nodeId}-${direction}-${depth}`;
    }

    // Helper function to check if two nodes are directly connected
    function isDirectlyConnected(nodeId1: string, nodeId2: string): boolean {
      // Check if node1 is a direct parent/child of node2 in the original data
      const node1Data = findOriginalData(relationShipTree, nodeId1);
      const node2Data = findOriginalData(relationShipTree, nodeId2);

      if (!node1Data || !node2Data) return false;

      // Check if node1 is a direct child of node2
      const node1IsChildOfNode2 =
        node2Data.children?.some((child) => child.id === nodeId1) || false;

      // Check if node1 is a direct parent of node2
      const node1IsParentOfNode2 =
        node1Data.children?.some((child) => child.id === nodeId2) || false;

      // Check parent relationships too
      const node1IsParentOfNode2Alt =
        node2Data.parents?.some((parent) => parent.id === nodeId1) || false;
      const node2IsParentOfNode1 =
        node1Data.parents?.some((parent) => parent.id === nodeId2) || false;

      return (
        node1IsChildOfNode2 ||
        node1IsParentOfNode2 ||
        node1IsParentOfNode2Alt ||
        node2IsParentOfNode1
      );
    }

    // Store positions for smooth transitions - only update positions for affected nodes
    actualNodes.forEach((d) => {
      const nodeId = d.data.id;
      const direction = d.data.direction;
      const positionKey = getPositionKey(nodeId, direction, d.data.depth);

      if (!nodePositions.has(positionKey)) {
        // New node - store its calculated position with direction-specific key
        nodePositions.set(positionKey, { x: d.x, y: d.y });
      } else {
        // Existing node - maintain stable position unless it's near the expansion
        const stored = nodePositions.get(positionKey)!;

        // Simple rule: only allow position changes for nodes that are:
        // 1. The root node (always stable, but still direction matters for left vs right)
        // 2. Direct children/parents of the toggled node
        // 3. New nodes being added

        if (nodeId === relationShipTree.id) {
          // Root node - always keep stable (but direction matters for left vs right)
          d.x = stored.x;
          d.y = stored.y;
        } else if (
          lastExpandedNode &&
          isDirectlyConnected(nodeId, lastExpandedNode)
        ) {
          // Node is directly connected to the one being expanded - allow movement
          d.x0 = stored.x;
          d.y0 = stored.y;
          nodePositions.set(positionKey, { x: d.x, y: d.y });
        } else {
          // All other nodes - keep stable position
          d.x = stored.x;
          d.y = stored.y;
        }
      }
    });

    // UPDATE PATTERN FOR LINKS - No more clearing!
    const linkSelection = linkGroup
      .selectAll(".link-group")
      .data(
        actualLinks,
        (d: any) =>
          `${d.source.data.id}-${d.source.data.direction}-${d.target.data.id}-${d.target.data.direction}`
      );

    // Remove old links with transition
    linkSelection
      .exit()
      .transition()
      .duration(500)
      .style("opacity", 0)
      .remove();

    // Add new links
    const linkEnter = linkSelection
      .enter()
      .append("g")
      .attr("class", "link-group")
      .style("opacity", 0)
      .on("click", function(event, d: any) {
        event.stopPropagation();
        // console.log(d);
        const sourceId = d.source.data.originalId || d.source.data.id;
        const targetId = d.target.data.originalId || d.target.data.id;
        let direction: 'read' | 'write' = 'read'
        if(sourceId.includes('bot:')){
          direction = 'write';
        }

        handleLinkClick(sourceId, targetId, direction);
      });

    // Add the actual link paths
    linkEnter
      .append("path")
      .attr("class", "link")
      .style("stroke", strokeColor!)
      .style("stroke-width", "2px")
      .style("fill", "none");

    // Add white background rectangle for text above the link
    linkEnter
      .append("rect")
      .attr("class", "link-text-above-bg")
      .style("fill", "white")
      .style("rx", "3") // Rounded corners
      .style("ry", "3")
      .style("pointer-events", "none");

    // Add text above the link (event count)
    linkEnter
      .append("text")
      .attr("class", "link-text-above")
      .style("text-anchor", "middle")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none"); // Prevent text from interfering with interactions

    // Add white background rectangle for text below the link
    linkEnter
      .append("rect")
      .attr("class", "link-text-below-bg")
      .style("fill", "white")
      .style("rx", "3") // Rounded corners
      .style("ry", "3")
      .style("pointer-events", "none");

    // Add text below the link (time ago)
    linkEnter
      .append("text")
      .attr("class", "link-text-below")
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#666")
      .style("pointer-events", "none"); // Prevent text from interfering with interactions

    // Merge and update all links
    const linkUpdate = linkEnter.merge(linkSelection);

    // Start links from their previous positions for smooth transitions
    linkUpdate
      .select("path")
      .transition()
      .duration(500)
      .ease(d3.easeQuadInOut)
      .attr("d", (d) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        return generateSmartCurve(sourceX, sourceY, targetX, targetY, nodeWidth!);
      });

   

    // Update link text positions and content
    linkUpdate
      .selectAll(".link-text-above")
      .transition()
      .duration(500)
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2 - 8)
      .text((d: any) => {
         let linkSourceId;
          let linkTargetId;

          if (d.source.data.type == "bot") {
            linkSourceId = `bot:${d.source.data.originalId || d.source.data.id}`;
          } else {
            linkSourceId = d.source.data.originalId || d.source.data.id;
          }

          if (d.target.data.type == "bot") {
            linkTargetId = `bot:${d.target.data.originalId || d.target.data.id}`;
          } else {
            linkTargetId = d.target.data.originalId || d.target.data.id;
          }
        const stats = getLinkStats(linkSourceId, linkTargetId);
        return stats.eventCount.toLocaleString();
      }).each(function(d: any) {
    // After text is set, get its dimensions and update background
        try {
          const bbox = this.getBBox();
          const padding = 4;
          
          d3.select(this.parentNode)
            .select(".link-text-above-bg")
            .attr("x", bbox.x - padding)
            .attr("y", bbox.y - padding)
            .attr("width", bbox.width + (padding * 2))
            .attr("height", bbox.height + (padding * 2));
        } catch (error) {
          // Fallback if getBBox fails
          console.warn("getBBox failed for link-text-above, using fallback", error);
          d3.select(this.parentNode)
            .select(".link-text-above-bg")
            .attr("x", -25)
            .attr("y", -8)
            .attr("width", 50)
            .attr("height", 16);
        }
      });


    linkUpdate
      .selectAll(".link-text-below")
      .transition()
      .duration(500)
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2 + 15)
      .text((d: any) => {
         let linkSourceId;
          let linkTargetId;
          let sourceType = d.source.data.type;
          let targetType = d.target.data.type;

          if (sourceType == "bot") {
            linkSourceId = `bot:${d.source.data.originalId || d.source.data.id}`;
          } else {
            linkSourceId = d.source.data.originalId || d.source.data.id;
          }

          if (targetType == "bot") {
            linkTargetId = `bot:${d.target.data.originalId || d.target.data.id}`;
          } else {
            linkTargetId = d.target.data.originalId || d.target.data.id;
          }
          // console.log(linkSourceId);
        const stats = getLinkStats(linkSourceId, linkTargetId);
        return getLowerText(stats);
      }).each(function(d: any) {
        // After text is set, get its dimensions and update background
        try {
          const bbox = this.getBBox();
          const padding = 4;
          
          d3.select(this.parentNode)
            .select(".link-text-below-bg")
            .attr("x", bbox.x - padding)
            .attr("y", bbox.y - padding)
            .attr("width", bbox.width + (padding * 2))
            .attr("height", bbox.height + (padding * 2));
        } catch (error) {
          // Fallback if getBBox fails
          console.warn("getBBox failed for link-text-below, using fallback", error);
          d3.select(this.parentNode)
            .select(".link-text-below-bg")
            .attr("x", -30)
            .attr("y", -8)
            .attr("width", 60)
            .attr("height", 16);
        }
      });

    // Fade in new and updated links
    linkUpdate.transition().duration(300).style("opacity", 1);

    // Update selected link styling
    linkGroup.selectAll(".link-group").classed("selected", function(d: any) {
      if (!selectedLink) return false;
      const sourceId = d.source.data.originalId || d.source.data.id;
      const targetId = d.target.data.originalId || d.target.data.id;
      return (sourceId === selectedLink.sourceId && targetId === selectedLink.targetId) ||
             (sourceId === selectedLink.targetId && targetId === selectedLink.sourceId);
    });

    // UPDATE PATTERN FOR NODES - No more clearing!
    const nodeSelection = nodeGroup
      .selectAll(".node")
      .data(actualNodes, (d: any) => `${d.data.id}-${d.data.direction}-${d.data.depth}`); // Include direction in key

    // Remove old nodes with transition
    nodeSelection
      .exit()
      .transition()
      .duration(500)
      .style("opacity", 0)
      .attr("transform", (d: any) => {
        // Exit nodes towards their parent's position
        const parent = d.parent;
        const parentPos = parent
          ? nodePositions.get(parent.data.id)
          : { x: d.x, y: d.y };
        return `translate(${parentPos?.x || d.x},${parentPos?.y || d.y})`;
      })
      .remove();

    // Add new nodes
    const nodeEnter = nodeSelection
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => {
        // Start new nodes at their parent's position for smooth entrance
        const parentPos = d.parent
          ? nodePositions.get(d.parent.data.id)
          : { x: d.x, y: d.y };
        return `translate(${parentPos?.x || d.x},${parentPos?.y || d.y})`;
      })
      .style("opacity", 0)
      .style("cursor", "pointer") // All nodes are clickable for info
      .on("click", (event, d) => {
        // Node click only shows information and highlights - no expand/collapse
        const statusInfo = d.data.status ? `<p><strong>Status:</strong> ${d.data.status}</p>` : '';
        const alarmInfo = d.data.isAlarmed ? `<p><strong>Alarmed:</strong> Yes</p>` : '';
        const pausedInfo = d.data.paused ? `<p><strong>Paused:</strong> Yes</p>` : '';
        const rogueInfo = d.data.rogue ? `<p><strong>Rogue:</strong> Yes</p>` : '';
        
        d3.select("#node-info").html(`
          <p><strong>ID:</strong> ${d.data.originalId || d.data.id}</p>
          <p><strong>Name:</strong> ${d.data.name}</p>
          <p><strong>Type:</strong> ${d.data.type}</p>
          <p><strong>Generation:</strong> ${d.depth === 0 ? "Root" : d.depth === 1 ? "1st" : d.depth === 2 ? "2nd" : "3rd"}</p>
          <p><strong>Direction:</strong> ${d.data.direction}</p>
          ${statusInfo}
          ${alarmInfo}
          ${pausedInfo}
          ${rogueInfo}
        `);

        // Highlight connected nodes
        highlightConnections(d);
      });

    // Add node shapes to new nodes
    nodeEnter.each(function (d) {
      const element = d3.select(this);

      // Skip rendering for virtual nodes - they're invisible spacers
      if (d.data.isVirtual) {
        return;
      }

      // Base circle for all nodes
      element
        .append("circle")
        .attr("class", "node-circle")
        .attr("r", nodeWidth! / 2)
        .style("fill", "#FFFF")
        .style("stroke", strokeColor!)
        .style("stroke-width", d.data.depth === 0 ? 8 : 2);

      
      let expandCircleGroup = element.insert('g', ':first-child').attr('class', createGoodIdentifier('unexpanded-circle-group-',d.data.id));

      // Add visual circles to easily indicate whether a node has relationships that haven't been expanded yet
      expandCircleGroup.append('circle')
        .attr('class', 'node-circle-left')
        .attr('r', 1e-6)
        .style('opacity', .5)
        .attr('transform', 'translate(-10, -20)')
        .style('stroke', '#A8D6F2')
        .style("stroke-width",  2)
        .style('fill', 'transparent');

      expandCircleGroup.append('circle')
        .attr('class', 'node-circle-right')
        .attr('r', 1e-6)
        .style('opacity', .5)
        .attr('transform', 'translate(13, -12)')
        .style('stroke', '#A8D6F2')
        .style("stroke-width",  2)
        .style('fill', 'transparent');

      // Add type-specific images
      if (d.data.type === "queue") {
        element
          .append("image")
          .attr("class", "node-image")
          .attr("xlink:href", "/queue.png")
          .attr("x", -nodeWidth! / 2)
          .attr("y", -nodeWidth! / 2)
          .attr("height", nodeWidth!)
          .attr("width", nodeWidth!);
      } else if (d.data.type === "bot") {

        let botImg;
        const botStatus = d.data.status || 'running';
        
        if (d.data.paused) {
          botImg = "/bot-paused.png";
        } else if (botStatus === 'rogue') {
          botImg = "/bot-rogue.png";
        } else if (botStatus === 'danger') {
          botImg = "/bot-danger.png";
        } else if (botStatus === 'blocked') {
          botImg = "/bot-blocked.png";
        } else if (botStatus === 'archived') {
          botImg = "/bot-archived.png";
        } else {
          botImg = "/bot.png";
        }

        element
          .append("image")
          .attr("class", "node-image")
          .attr("xlink:href", botImg)
          .attr("x", -nodeWidth! / 2)
          .attr("y", -nodeWidth! / 2)
          .attr("height", nodeWidth!)
          .attr("width", nodeWidth!);
      } else {
        element
          .append("image")
          .attr("class", "node-image")
          .attr("xlink:href", "/system.png")
          .attr("x", -nodeWidth! / 2)
          .attr("y", -nodeWidth! / 2)
          .attr("height", nodeWidth!)
          .attr("width", nodeWidth!);
      }

      // Add text labels with intelligent wrapping
      createNodeLabel(nodeWidth!, element, d);

      // Check if this node should have expand/collapse buttons
      const nodeOriginalId = getOriginalNodeId(d.data);
      const originalData = findOriginalData(relationShipTree, nodeOriginalId);
      const isRootNode = d.data.id === relationShipTree.id;
      
      // Check for available children/parents
      const hasChildren = originalData?.children && originalData.children.length > 0;
      const hasParents = originalData?.parents && originalData.parents.length > 0;
      
      // Check current state
      const childrenExpanded = expandedNodes.has(`${nodeOriginalId}-children`);
      const parentsExpanded = expandedNodes.has(`${nodeOriginalId}-parents`);
      const childrenCollapsed = expandedNodes.has(`${nodeOriginalId}-children-collapsed`);
      const parentsCollapsed = expandedNodes.has(`${nodeOriginalId}-parents-collapsed`);
      
      // Determine default visibility state for buttons
      const defaultChildrenVisible = hasChildren && (originalData?.children?.length || 0) === 1;
      const defaultParentsVisible = hasParents && (originalData?.parents?.length || 0) === 1;

      let needsChildrenButton: boolean | undefined;
      let needsParentsButton: boolean | undefined;
      
      // For root node, always show both buttons if there are children or parents available
      if (isRootNode) {
        needsChildrenButton = hasChildren;
        needsParentsButton = hasParents;
      } else {
        // For non-root nodes, show buttons if:
        // 1. There are multiple relations (need button to expand/collapse)
        // 2. There are relations that are currently visible (need button to collapse)
        // 3. There are relations that have been explicitly collapsed (need button to expand)
        needsChildrenButton = hasChildren && (
          (originalData?.children?.length || 0) > 1 || // Multiple children available
          defaultChildrenVisible || // Single child shown by default
          childrenExpanded || // Explicitly expanded
          childrenCollapsed // Explicitly collapsed
        );
        
        needsParentsButton = hasParents && (
          (originalData?.parents?.length || 0) > 1 || // Multiple parents available
          defaultParentsVisible || // Single parent shown by default
          parentsExpanded || // Explicitly expanded
          parentsCollapsed // Explicitly collapsed
        );
      }

      const currentParentsExpanded = expandedNodes.has(`${d.data.id}-parents`);
      const currentParentsCollapsed = expandedNodes.has(`${d.data.id}-parents-collapsed`);
      
      // If explicitly expanded OR (default visible and not explicitly collapsed)
      const parentsCurrentlyShowing = currentParentsExpanded || 
        (defaultParentsVisible && !currentParentsCollapsed);
      // Add left button (parents) if needed
      if (needsParentsButton) {
        const leftButtonGroup = element.append("g").attr("class", "left-button-group");

        const leftButtonCircle = leftButtonGroup
          .append("circle")
          .attr("class", "button-circle left-button")
          .attr("cx", -nodeWidth! / 3)
          .attr("cy", nodeWidth! / 3)
          .attr("r", 10)
          .style("stroke", "#333")
          .style("stroke-width", 1)
          .style("fill", "#FFFF")
          .style("opacity", 0)
          .style("cursor", "pointer");

          let leftChevronIcon = createLucideIconFromComponent(
            leftButtonGroup,
            ChevronLeft,
            -nodeWidth! / 3,
            nodeWidth! / 3,
            12,
            'left-chevron'
          );

          if(leftChevronIcon) {
            leftChevronIcon.style("opacity", 0).style("color", "black");
            (leftButtonGroup.node() as any).__chevronIcon = leftChevronIcon;
          }

        // Add click handler for left button (parents)
        leftButtonGroup.on("click", function (event, buttonData) {
          event.stopPropagation();
          const originalId = getOriginalNodeId(buttonData.data);
          let res = toggleNodeExpansion(originalId, 'parents', expandedNodes, relationShipTree);
          expandedNodes = res.expandedNodes;
          lastExpandedNode = res.lastExpandedNode;
          renderVisualization();
          setTimeout(() => {
            updateVisibleNodesFromDOM();
          }, 600)
        });

        // Add hover effects for left button
        element
          .on("mouseenter.leftButton", function () {
            // Determine button text based on current state

            const shouldPointRight = parentsCurrentlyShowing;

            if(leftChevronIcon) {
              leftChevronIcon.remove()
            }

            leftChevronIcon = createLucideIconFromComponent(
              leftButtonGroup,
              shouldPointRight ? ChevronRight : ChevronLeft,
              -nodeWidth! / 3,
              nodeWidth! / 3,
              12,
              'left-chevron'
            );

            if (leftChevronIcon) {
              leftChevronIcon.style("color", "black");
              leftChevronIcon.transition().duration(200).style("opacity", 1);
            }

            leftButtonCircle.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave.leftButton", function () {
            leftButtonCircle.transition().duration(200).style("opacity", 0);
            if(leftChevronIcon) {
              leftChevronIcon.transition().duration(200).style("opacity", 0);
            }
          });
      }

      const currentChildrenExpanded = expandedNodes.has(`${d.data.id}-children`);
      const currentChildrenCollapsed = expandedNodes.has(`${d.data.id}-children-collapsed`);
      
      // If explicitly expanded OR (default visible and not explicitly collapsed)
      const childrenCurrentlyShowing = currentChildrenExpanded || 
        (defaultChildrenVisible && !currentChildrenCollapsed);

      // Add right button (children) if needed
      if (needsChildrenButton) {
        const rightButtonGroup = element.append("g").attr("class", "right-button-group");

        const rightButtonCircle = rightButtonGroup
          .append("circle")
          .attr("class", "button-circle right-button")
          .attr("cx", nodeWidth! / 3)
          .attr("cy", nodeWidth! / 3)
          .attr("r", 10)
          .style("stroke", "#333")
          .style("stroke-width", 1)
          .style("fill", "#FFFF")
          .style("opacity", 0)
          .style("cursor", "pointer");

          let rightChevronIcon = createLucideIconFromComponent(
            rightButtonGroup,
            ChevronRight,
            -nodeWidth! / 3,
            nodeWidth! / 3,
            12,
            'right-chevron'
          );

          if(rightChevronIcon) {
            rightChevronIcon.style("opacity", 0).style("color", "black");
            (rightButtonGroup.node() as any).__chevronIcon = rightChevronIcon;
          }

        // const rightButtonText = rightButtonGroup
        //   .append("text")
        //   .attr("class", "button-text right-button-text")
        //   .attr("x", nodeWidth! / 3)
        //   .attr("y", nodeWidth! / 3)
        //   .attr("dy", ".35em")
        //   .style("text-anchor", "middle")
        //   .style("fill", "black")
        //   .style("font-size", "18px")
        //   .style("font-weight", "bold")
        //   .style("opacity", 0)
        //   .style("cursor", "pointer")
        //   .style("pointer-events", "none");

        // Add click handler for right button (children)
        rightButtonGroup.on("click", function (event, buttonData) {
          event.stopPropagation();
          const originalId = getOriginalNodeId(buttonData.data);
          let res = toggleNodeExpansion(originalId, 'children', expandedNodes, relationShipTree);
          expandedNodes = res.expandedNodes;
          lastExpandedNode = res.lastExpandedNode;
          renderVisualization();

          setTimeout(() => {
            updateVisibleNodesFromDOM();
          }, 600)
        });

        // Add hover effects for right button
        element
          .on("mouseenter.rightButton", function () {
            // Determine button text based on current state
            const shouldPointLeft = childrenCurrentlyShowing;
            // console.log('shouldPointLeft:', shouldPointLeft);

            if(rightChevronIcon) {
              rightChevronIcon.remove()
            }

            rightChevronIcon = createLucideIconFromComponent(
              rightButtonGroup,
              shouldPointLeft ? ChevronLeft : ChevronRight,
              nodeWidth! / 3,
              nodeWidth! / 3,
              12,
              'right-chevron'
            );

            if (rightChevronIcon) {
              rightChevronIcon.style("color", "black");
              rightChevronIcon.transition().duration(200).style("opacity", 1);
            }

            rightButtonCircle.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave.rightButton", function () {
            rightButtonCircle.transition().duration(200).style("opacity", 0);
            if(rightChevronIcon) {
              rightChevronIcon.transition().duration(200).style("opacity", 0);

            }
          });
      }

      if((needsParentsButton && !parentsCurrentlyShowing) || (needsChildrenButton && !childrenCurrentlyShowing)) {
        handleBackgroundNodeCircles(d.data.id, 'expand');
      } 
      
      const hasMany = (originalData?.children?.length || 0) > 10 || (originalData?.parents?.length || 0) > 10;
      const hasManyChildren = (originalData?.children?.length || 0) > 10 
      const hasManyParents = (originalData?.parents?.length || 0) > 10

      if (hasMany) {
        // Add filter icon button
        const filterButtonGroup = element.append("g").attr("class", "filter-button-group");
        
        const filterButton = filterButtonGroup
          .append("circle")
          .attr("class", "filter-button")
          .attr("cx", 0)
          .attr("cy", -nodeWidth! / 2 - 15)
          .attr("r", 8)
          .style("fill", "#f3f4f6")
          .style("stroke", "#6b7280")
          .style("stroke-width", 1)
          .style("cursor", "pointer")
          .style("opacity", 0);

          const filterIcon = createLucideIconFromComponent(
            filterButtonGroup,
            Filter,
            0,
            -nodeWidth! / 2 - 15,
            12,
            'filter-icon'
          );

          if(filterIcon) {
            filterIcon
            .style("opacity", "0")
            .style("transform-origin", "center")
            .style("transition", "all 0.2s ease");
          }

          (filterButtonGroup.node() as any).__iconInstance = filterIcon;
          
          
        // Show filter button on hover
        element
          .on("mouseenter.filter", function() {
            filterButton.transition().duration(200).style("opacity", 1);
            if(filterIcon) {
              filterIcon.transition().duration(200).style("opacity", 1);

            }
          })
          .on("mouseleave.filter", function() {
            filterButton.transition().duration(200).style("opacity", 0);
            if (filterIcon) {
              filterIcon.transition().duration(200).style("opacity", 0);
            }
          });
          
        // Handle filter button click
        filterButtonGroup.on("click", function(event, d) {
          event.stopPropagation();
          const direction = (originalData?.children?.length || 0) > 10 ? 'children' : 'parents';
          toggleFilterControls(d.data.id, direction);
        });
      }


    });

    // Merge and update all nodes
    const nodeUpdate = nodeEnter.merge(nodeSelection);

    // Update button states for all nodes (both new and existing)
    nodeUpdate.each(function (d) {
      const element = d3.select(this);
      const originalData = findOriginalData(relationShipTree, d.data.id);
      const isRootNode = d.data.id === relationShipTree.id;
      
      // Update current state
      const nodeOriginalId = getOriginalNodeId(d.data);
      const childrenExpanded = expandedNodes.has(`${nodeOriginalId}-children`);
      const parentsExpanded = expandedNodes.has(`${nodeOriginalId}-parents`);
      const childrenCollapsed = expandedNodes.has(`${nodeOriginalId}-children-collapsed`);
      const parentsCollapsed = expandedNodes.has(`${nodeOriginalId}-parents-collapsed`);
      
      // Determine default visibility
      const defaultChildrenVisible = originalData?.children && (originalData?.children?.length || 0) === 1;
      const defaultParentsVisible = originalData?.parents && (originalData?.parents?.length || 0) === 1;

      // Update left button (parents) hover behavior
      const leftButtonGroup = element.select(".left-button-group");
      if (!leftButtonGroup.empty()) {
        element
          .on("mouseenter.leftButtonUpdate", function () {
            const leftButtonText = leftButtonGroup.select(".left-button-text");
            const leftButtonCircle = leftButtonGroup.select(".button-circle");
            
            // Determine if parents are currently showing
            const parentsCurrentlyShowing = parentsExpanded || 
              (defaultParentsVisible && !parentsCollapsed);
            
            let buttonText = parentsCurrentlyShowing ? ">" : "<";
            leftButtonText.text(buttonText);
            leftButtonCircle.transition().duration(200).style("opacity", 1);
            leftButtonText.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave.leftButtonUpdate", function () {
            const leftButtonText = leftButtonGroup.select(".left-button-text");
            const leftButtonCircle = leftButtonGroup.select(".button-circle");
            leftButtonCircle.transition().duration(200).style("opacity", 0);
            leftButtonText.transition().duration(200).style("opacity", 0);
          });
      }

      // Update right button (children) hover behavior
      const rightButtonGroup = element.select(".right-button-group");
      if (!rightButtonGroup.empty()) {
        element
          .on("mouseenter.rightButtonUpdate", function () {
            const rightButtonText = rightButtonGroup.select(".right-button-text");
            const rightButtonCircle = rightButtonGroup.select(".button-circle");
            
            // Determine if children are currently showing
            const childrenCurrentlyShowing = childrenExpanded || 
              (defaultChildrenVisible && !childrenCollapsed);
            
            let buttonText = childrenCurrentlyShowing ? "<" : ">";
            rightButtonText.text(buttonText);
            rightButtonCircle.transition().duration(200).style("opacity", 1);
            rightButtonText.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave.rightButtonUpdate", function () {
            const rightButtonText = rightButtonGroup.select(".right-button-text");
            const rightButtonCircle = rightButtonGroup.select(".button-circle");
            rightButtonCircle.transition().duration(200).style("opacity", 0);
            rightButtonText.transition().duration(200).style("opacity", 0);
          });
      }
    });

    // Update node positions with smooth transitions
    nodeUpdate
      .transition()
      .duration(500)
      .ease(d3.easeQuadInOut)
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("opacity", 1);

    // Update link positions smoothly
    linkUpdate
      .select("path")
      .transition()
      .duration(500)
      .ease(d3.easeQuadInOut)
      .attr("d", (d) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        return generateSmartCurve(sourceX, sourceY, targetX, targetY, nodeWidth!);
      });

    // Fade in new and updated links
    linkUpdate.transition().duration(500).style("opacity", 1);

    // Function to highlight connections
    function highlightConnections(
      selectedNode: d3.HierarchyPointNode<unknown>
    ) {
      // Reset all nodes and links
      nodeGroup
        .selectAll(".node")
        .classed("highlighted", false)
        .classed("faded", false);
      linkGroup
        .selectAll(".link")
        .classed("highlighted", false)
        .classed("faded", true);

      // Highlight the selected node
      nodeGroup
        .selectAll(".node")
        .filter((d) => d.data.id === selectedNode.data.id)
        .classed("highlighted", true)
        .classed("faded", false);

      // Highlight directly connected links and nodes
      linkGroup.selectAll(".link").each(function (d) {
        if (
          d.source.data.id === selectedNode.data.id ||
          d.target.data.id === selectedNode.data.id
        ) {
          d3.select(this).classed("highlighted", true).classed("faded", false);

          // Highlight connected nodes
          nodeGroup
            .selectAll(".node")
            .filter(
              (node) =>
                node.data.id === d.source.data.id ||
                node.data.id === d.target.data.id
            )
            .classed("highlighted", true)
            .classed("faded", false);
        }
      });
    }


    setTimeout(() => {
      updateVisibleNodesFromDOM()
    }, 600);
  }


  function getVisibleNodeCount(): number {
    return appState.botState.visibleIds.length;
  }

  // Handle link click to select a relationship
  function handleLinkClick(sourceId: string, targetId: string, direction: 'read' | 'write') {
    selectedLink = { sourceId, targetId, direction };
    
    // Keep charts visible if they were already open, but clear stats to trigger refresh
    if (chartsVisible) {
      dashboardStats = null; // Clear previous stats to trigger refresh
    }
    
    // Update link styling to show selection
    renderVisualization();
  }

  // Handle "Show Charts" button click
  async function handleShowCharts() {
    if (!selectedLink) return;
    
    chartsLoading = true;
    try {

      if(selectedLink.sourceId.startsWith('queue:') || selectedLink.sourceId.startsWith('system:')) {
        dashboardStats = await appState.botState.fetchDashboardStats('bot:' + selectedLink.targetId);
      } else {
        dashboardStats = await appState.botState.fetchDashboardStats('bot:' + selectedLink.sourceId);
      }

      // we always need to fetch the dashboard stats from the perspective of the bot
      // dashboardStats = await appState.botState.fetchDashboardStats(selectedLink.sourceId.includes('bot:') ? selectedLink.sourceId : selectedLink.targetId);
      chartsVisible = true;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      chartsLoading = false;
    }
  }

  // Close charts
  function closeCharts() {
    chartsVisible = false;
    dashboardStats = null;
  }

  // Effect to automatically fetch new dashboard stats when link changes and charts are visible
  $effect(() => {
    if (selectedLink && chartsVisible && !dashboardStats) {
      // Automatically fetch new stats when a new link is selected and charts are visible
      handleShowCharts();
    }
  });
</script>

<div class="workflow-container">
  <div id="tree-container"></div>
  <div class="filter-controls-container">
    {#if currentFilterKey}
      {@const [nodeId, direction] = currentFilterKey.split('-') as [string, 'children' | 'parents']}
      {@const originalData = findOriginalData(relationShipTree, nodeId)}
      {@const relationships = direction === 'children' ? originalData?.children : originalData?.parents}
      {@const filterOptions = relationshipFilters.get(currentFilterKey) || {...DEFAULT_FILTER_OPTIONS}}
      {@const summary = getRelationshipSummary(relationships, linkStats, nodeId, direction, filterOptions)}
      
      <div class="filter-control-wrapper" style="position: absolute; z-index: 1000;">
        <RelationshipFilterControls
          {nodeId}
          {direction}
          {filterOptions}
          {summary}
          filterChange={(newOptions) => handleFilterChange(nodeId, direction, newOptions)}
          bind:open={filterDrawerOpen}
        />
    </div>
    {/if}
  </div>
  <div class="absolute bottom-4 right-4 z-50 max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)]">
    <!-- Show Charts Button -->
    {#if selectedLink}
      <button 
        class="bg-gray-700 text-white border-none px-4 py-2 rounded cursor-pointer text-sm mb-4 flex items-center gap-2 shadow-lg hover:bg-gray-600 disabled:bg-gray-500 disabled:cursor-not-allowed"
        onclick={handleShowCharts}
        disabled={chartsLoading}
      >
        {#if chartsLoading}
          Loading...
        {:else}
          Show Charts
        {/if}
      </button>
    {/if}

    <!-- Charts Details Pane Component -->
    <ChartDetailsPane 
      {dashboardStats}
      {selectedLink}
      visible={chartsVisible}
      onClose={closeCharts}
      range={currentRange}
    />
  </div>
</div>

<style>
  .filter-controls-container {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 1000;
  }
  
  .filter-control-wrapper {
    pointer-events: all;
  }
  
  /* Enhanced node styles for filter indicators */
  :global(.node.has-filters) {
    outline: 2px dashed rgba(59, 130, 246, 0.3);
    outline-offset: 4px;
  }
  
  :global(.node.filters-active) {
    outline: 2px solid #3b82f6;
    outline-offset: 4px;
  }
  
  /* Filter button animations */
  :global(.filter-button) {
    transition: all 0.2s ease;
  }
  
  :global(.filter-button:hover) {
    fill: #e5e7eb !important;
    transform: scale(1.1);
  }

  .workflow-container {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    width: 100%;
    height: calc(100vh - 128px); /* Subtract header height - adjust as needed */
    overflow: hidden;
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  #tree-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  #tree-container svg {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }

  /* Link selection styles */
  :global(.link-group.selected .link) {
    stroke: #505ce5 !important;
    stroke-width: 4px !important;
  }

  :global(.link-group:hover .link) {
    stroke: #f59e0b !important;
    stroke-width: 3px !important;
    cursor: pointer;
  }
</style>
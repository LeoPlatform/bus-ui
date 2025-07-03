<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
  import type { TreeNode } from "$lib/types";
  import { humanize } from "$lib/utils";
  import { error } from "@sveltejs/kit";
  import * as d3 from "d3";
  import { getContext, onMount, untrack } from "svelte";
  import type { LinkStats } from "./types";
  import { createGoodIdentifier, findOriginalData, handleBackgroundNodeCircles, initializeLinkStats, processTree, toggleNodeExpansion } from "./tree-utils.svelte";
  import { createNodeLabel, createTreeLayout, setupZoomBehavior } from "./d3-utils.svelte";

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
    
    const treeData = relationShipTree;


    if (!treeData) {
      error(500, "failed to generate tree data");
      return;
    }

    initializeVisualization();
    initializeLinkStats(botStats, linkStats);

    return () => {
      resizeObserver.disconnect();
    };
    
  })

  function updateContainerDimensions() {
    if (containerElement) {
      const rect = containerElement.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = rect.height;
    }
}

  $effect(() => {
    const timer = setInterval(() => {
      untrack( async() => {
        console.log(`${appState.botState.staleTime / 1000} seconds elapsed - refreshing stats data`);
        await appState.botState.fetchBotStats(appState.timePickerState);
        initializeLinkStats(botStats, linkStats);
        renderVisualization
      })
    }, appState.botState.staleTime);

    return () => clearInterval(timer);
  })

  $effect(() => {

    const count = currentNodeCount;

    if(count === 0) {
      return;
    }

    untrack( async () => {
      await appState.botState.fetchBotStats(appState.timePickerState);
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
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create persistent groups for links and nodes
    linkGroup = svg.append("g").attr("class", "links");
    nodeGroup = svg.append("g").attr("class", "nodes");

    // Add zoom behavior
    zoomHandler = setupZoomBehavior(svg);

    d3.select("#tree-container svg").call(zoomHandler);

    renderVisualization();
  }

  function getLinkStats(parentId: string, childId: string): LinkStats {

    // remove bot: from the parent and child
    const tempParentId = parentId.replace('bot:', '');
    const tempChildId = childId.replace('bot:', '');

    const botData = appState.botState.botSettings.find(bot => bot.id === tempParentId || bot.id === tempChildId);
    const type = botData?.id == tempParentId ? 'write' : 'read';
    const endedTimestamp = botData?.checkpoints?.[type]?.[tempChildId]?.ended_timestamp;

    if(!linkStats) {
      return { eventCount: 0, lastWrite: endedTimestamp ?? Date.now(), linkType: type }
    }
    // TODO: Replace this with actual lookup logic based on your data structure
    const key = `${parentId}-${childId}`;
    console.log('getLInkStats key:', key);
    console.log('linkStats',linkStats);
    const linkStat = linkStats.get(key);
    console.log('linkStat', linkStat);

    return linkStat || { eventCount: 0, lastWrite: endedTimestamp ?? Date.now(), linkType: type };
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
        let id = d.data.id;
        if (d.data.type == "bot") {
          id = `bot:${d.data.id}`;
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

  function renderVisualization() {
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Create separate trees for left and right directions
    const rightRoot = processTree(relationShipTree, "right", expandedNodes);
    const leftRoot = processTree(relationShipTree, "left", expandedNodes);

    

    // Create tree data structures
    const rightTreeResult = createTreeLayout(rightRoot, "right", height, nodeWidth!);
    const leftTreeResult = createTreeLayout(leftRoot, "left", height, nodeWidth!);
    const rightTree: d3.HierarchyPointNode<TreeNode> = rightTreeResult.treeData;
    const leftTree: d3.HierarchyPointNode<TreeNode> = leftTreeResult.treeData;

    // Use the maximum height from either tree
    const maxDynamicHeight = Math.max(
      rightTreeResult.dynamicHeight,
      leftTreeResult.dynamicHeight
    );

    // Adjust the height of the view using the dynamic height
    d3.select("#tree-container svg").attr(
      "height",
      maxDynamicHeight + margin.top + margin.bottom
    );

    // Combine nodes from both trees
    const allNodes: d3.HierarchyPointNode<TreeNode>[] = [...rightTree.descendants(), ...leftTree.descendants()];
    // Combine links from both trees
    const allLinks = [...rightTree.links(), ...leftTree.links()];

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
    allNodes.forEach((d) => {
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
        // 1. The root node (always stable, but still direction-specific)
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
        allLinks,
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
      .style("opacity", 0);

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

        return `M${sourceX},${sourceY}
                C${(sourceX + targetX) / 2},${sourceY}
                 ${(sourceX + targetX) / 2},${targetY}
                 ${targetX},${targetY}`;
      });

   

    // Update link text positions and content
    linkUpdate
      .selectAll(".link-text-above")
      .transition()
      .duration(500)
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2 - 8)
      .text((d) => {
         let linkSourceId;
          let linkTargetId;

          if (d.source.data.type == "bot") {
            linkSourceId = `bot:${d.source.data.id}`;
          } else {
            linkSourceId = d.source.data.id;
          }

          if (d.target.data.type == "bot") {
            linkTargetId = `bot:${d.target.data.id}`;
          } else {
            linkTargetId = d.target.data.id;
          }
        const stats = getLinkStats(linkSourceId, linkTargetId);
        return stats.eventCount.toLocaleString();
      }).each(function(d) {
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
      .text((d) => {
         let linkSourceId;
          let linkTargetId;
          let sourceType = d.source.data.type;
          let targetType = d.target.data.type;

          if (sourceType == "bot") {
            linkSourceId = `bot:${d.source.data.id}`;
          } else {
            linkSourceId = d.source.data.id;
          }

          if (targetType == "bot") {
            linkTargetId = `bot:${d.target.data.id}`;
          } else {
            linkTargetId = d.target.data.id;
          }
          console.log(linkSourceId);
        const stats = getLinkStats(linkSourceId, linkTargetId);
        return getLowerText(stats);
      }).each(function(d) {
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

    // UPDATE PATTERN FOR NODES - No more clearing!
    const nodeSelection = nodeGroup
      .selectAll(".node")
      .data(allNodes, (d: any) => `${d.data.id}-${d.data.direction}-${d.data.depth}`); // Include direction in key

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
        d3.select("#node-info").html(`
          <p><strong>ID:</strong> ${d.data.id}</p>
          <p><strong>Name:</strong> ${d.data.name}</p>
          <p><strong>Type:</strong> ${d.data.type}</p>
          <p><strong>Generation:</strong> ${d.depth === 0 ? "Root" : d.depth === 1 ? "1st" : d.depth === 2 ? "2nd" : "3rd"}</p>
          <p><strong>Direction:</strong> ${d.data.direction}</p>
        `);

        // Highlight connected nodes
        highlightConnections(d);
      });

    // Add node shapes to new nodes
    nodeEnter.each(function (d) {
      const element = d3.select(this);

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
        if (d.data.paused) {
          botImg = "/bot-paused.png"
        } else {
          botImg = "/bot.png"
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
      const originalData = findOriginalData(relationShipTree, d.data.id);
      const isRootNode = d.data.id === relationShipTree.id;
      
      // Check for available children/parents
      const hasChildren = originalData?.children && originalData.children.length > 0;
      const hasParents = originalData?.parents && originalData.parents.length > 0;
      
      // Check current state
      const childrenExpanded = expandedNodes.has(`${d.data.id}-children`);
      const parentsExpanded = expandedNodes.has(`${d.data.id}-parents`);
      const childrenCollapsed = expandedNodes.has(`${d.data.id}-children-collapsed`);
      const parentsCollapsed = expandedNodes.has(`${d.data.id}-parents-collapsed`);
      
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

        const leftButtonText = leftButtonGroup
          .append("text")
          .attr("class", "button-text left-button-text")
          .attr("x", -nodeWidth! / 3)
          .attr("y", nodeWidth! / 3)
          .attr("dy", ".35em")
          .style("text-anchor", "middle")
          .style("fill", "black")
          .style("font-size", "18px")
          .style("font-weight", "bold")
          .style("opacity", 0)
          .style("cursor", "pointer")
          .style("pointer-events", "none");

        // Add click handler for left button (parents)
        leftButtonGroup.on("click", function (event, buttonData) {
          event.stopPropagation();
          let res = toggleNodeExpansion(buttonData.data.id, 'parents', expandedNodes, relationShipTree);
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
            let buttonText;
            
            
            if (parentsCurrentlyShowing) {
              buttonText = ">"; // Collapse parents (point away from node)
            } else {
              buttonText = "<"; // Expand parents (point toward parents)
            }
            
            leftButtonText.text(buttonText);
            leftButtonCircle.transition().duration(200).style("opacity", 1);
            leftButtonText.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave.leftButton", function () {
            leftButtonCircle.transition().duration(200).style("opacity", 0);
            leftButtonText.transition().duration(200).style("opacity", 0);
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

        const rightButtonText = rightButtonGroup
          .append("text")
          .attr("class", "button-text right-button-text")
          .attr("x", nodeWidth! / 3)
          .attr("y", nodeWidth! / 3)
          .attr("dy", ".35em")
          .style("text-anchor", "middle")
          .style("fill", "black")
          .style("font-size", "18px")
          .style("font-weight", "bold")
          .style("opacity", 0)
          .style("cursor", "pointer")
          .style("pointer-events", "none");

        // Add click handler for right button (children)
        rightButtonGroup.on("click", function (event, buttonData) {
          event.stopPropagation();
          let res = toggleNodeExpansion(buttonData.data.id, 'children', expandedNodes, relationShipTree);
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
            let buttonText;
            
            if (childrenCurrentlyShowing) {
              buttonText = "<"; // Collapse children (point away from children)
            } else {
              buttonText = ">"; // Expand children (point toward children)
            }
            
            rightButtonText.text(buttonText);
            rightButtonCircle.transition().duration(200).style("opacity", 1);
            rightButtonText.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave.rightButton", function () {
            rightButtonCircle.transition().duration(200).style("opacity", 0);
            rightButtonText.transition().duration(200).style("opacity", 0);
          });
      }

      if((needsParentsButton && !parentsCurrentlyShowing) || (needsChildrenButton && !childrenCurrentlyShowing)) {
        handleBackgroundNodeCircles(d.data.id, 'expand');
      } 
      // else if(needsChildrenButton && !childrenCurrentlyShowing) {
      //   handleBackgroundNodeCircles(d.data.id, 'expand');
      // }

    });

    // Merge and update all nodes
    const nodeUpdate = nodeEnter.merge(nodeSelection);

    // Update button states for all nodes (both new and existing)
    nodeUpdate.each(function (d) {
      const element = d3.select(this);
      const originalData = findOriginalData(relationShipTree, d.data.id);
      const isRootNode = d.data.id === relationShipTree.id;
      
      // Update current state
      const childrenExpanded = expandedNodes.has(`${d.data.id}-children`);
      const parentsExpanded = expandedNodes.has(`${d.data.id}-parents`);
      const childrenCollapsed = expandedNodes.has(`${d.data.id}-children-collapsed`);
      const parentsCollapsed = expandedNodes.has(`${d.data.id}-parents-collapsed`);
      
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

        return `M${sourceX},${sourceY}
                C${(sourceX + targetX) / 2},${sourceY}
                 ${(sourceX + targetX) / 2},${targetY}
                 ${targetX},${targetY}`;
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
</script>

<div class="workflow-container">
  <div id="tree-container"></div>
</div>

<style>
  .workflow-container {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
  }


  #tree-container {
    /* border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9; */
    min-height: 800px;
  }


</style>
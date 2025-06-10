<script lang="ts">
  import type { AppState } from "$lib/client/appstate.svelte";
  import type { MergedStatsRecord, RelationshipTree, TreeNode } from "$lib/types";
  import { humanize } from "$lib/utils";
  import { error } from "@sveltejs/kit";
  import * as d3 from "d3";
  import { getContext, onMount, untrack } from "svelte";
  import type { LinkStats } from "./types";

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



  onMount(() => {
    const treeData = relationShipTree;
    if (!treeData) {
      error(500, "failed to generate tree data");
      return;
    }

    initializeVisualization();
    initializeLinkStats();
    
  })

  $effect(() => {
    const timer = setInterval(() => {
      untrack( async() => {
        console.log(`${appState.botState.staleTime / 1000} seconds elapsed - refreshing stats data`);
        await appState.botState.fetchBotStats();
        initializeLinkStats();
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
      await appState.botState.fetchBotStats();
      initializeLinkStats();
      renderVisualization();
    })
    // const currentNodeCount = appState.botState.visibleIds.length;
    
    // async function getStats() {
      
    //   if (currentNodeCount === 0) {
    //     return;
    //   }

    //   await appState.botState.fetchBotStats();
      
    // }
    // getStats();
    // initializeLinkStats();
    // renderVisualization();
  })

  function initializeLinkStats() {
    console.log('initializeLinkStats called, botStats length:', botStats.length);
    console.log('botStats:', botStats);
    if (!botStats || botStats.length === 0) {
      console.log('botStats is empty or undefined');
      return
    }

    // Convert the botStats proxy object into an array
    const statsArray = botStats;
    console.log('botStats to array:', statsArray);

    if (statsArray.length === 0) {
      return;
    }

    linkStats.clear();

    statsArray.forEach((stat: MergedStatsRecord) => {
      $state.snapshot(stat);
      let idKey = stat.id;
      if(stat.read) {
        // console.log('found read stats');
        Object.entries(stat.read).forEach(([childId, readStat]) => {
          let key = `${idKey}-${childId}`;
          linkStats.set(key, { eventCount: readStat.units, lastWrite: new Date(readStat.timestamp).getTime(), linkType: 'read' });
        });
      }
      if(stat.write) {
        // console.log('found write stats');
        Object.entries(stat.write).forEach(([parentId, writeStat]) => {
          let key = `${parentId}-${idKey}`;
          linkStats.set(key, { eventCount: writeStat.units, lastWrite: new Date(writeStat.timestamp).getTime(), linkType: 'write' });
        });
      }
    })

    linkStats = new Map(linkStats);
  }

  function initializeVisualization() {
    // Clear any existing SVG
    d3.select("#tree-container").selectAll("*").remove();

    // Set up SVG dimensions and margins
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = 1500 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    // Create the SVG container
    svg = d3
      .select("#tree-container")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create persistent groups for links and nodes
    linkGroup = svg.append("g").attr("class", "links");
    nodeGroup = svg.append("g").attr("class", "nodes");

    // Add zoom behavior
    zoomHandler = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        svg.attr("transform", event.transform);
      });

    d3.select("#tree-container svg").call(zoomHandler);

    renderVisualization();
  }

    //TODO: we will want this to grab stats data from the api for any visibile nodes.
  // TODO: we will also only want this to grab stats for freshly rendered nodes (don't refresh data we don't have to)
  // TODO: we will also want to fresh stats pull for all visible nodes every 30 seconds or so.
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

  function findOriginalData(nodeId: string): RelationshipTree | null {
    function search(data: RelationshipTree): RelationshipTree | null {
      if (data.id === nodeId) return data;

      // Search in children
      if (data.children) {
        for (const child of data.children) {
          const result = search(child);
          if (result) return result;
        }
      }

      // Search in parents
      if (data.parents) {
        for (const parent of data.parents) {
          const result = search(parent);
          if (result) return result;
        }
      }

      return null;
    }

    return search(relationShipTree);
  }

  function toggleNode(nodeId: string) {
    lastExpandedNode = nodeId; // Track which node is being toggled

    if (expandedNodes.has(nodeId)) {
      expandedNodes.delete(nodeId);
      console.log('Collapsed node:', nodeId);
    } else {
      expandedNodes.add(nodeId);
      console.log('Expanded node:', nodeId);
    }
    expandedNodes = new Set(expandedNodes); // Trigger reactivity

    renderVisualization(); // Re-render the tree

    setTimeout(() => {
      updateVisibleNodesFromDOM();
    }, 600);
  }

  function processTree(
    data: RelationshipTree,
    direction: "left" | "right",
    parent: TreeNode | undefined = undefined,
    depth = 0
  ): TreeNode {
    let dataType: "queue" | "system" | "bot";
    if (data.id.startsWith("queue:")) {
      dataType = "queue";
    } else if (data.id.startsWith("system:")) {
      dataType = "system";
    } else {
      dataType = "bot";
    }

    const node: TreeNode = {
      id: data.id,
      name: data.name,
      type: dataType,
      paused: data.paused,
      alarmed: data.alarmed,
      rogue: data.rogue,
      parent: parent,
      depth: depth,
      direction: direction,
      children: [],
      _children: [],
    };

    // Determine if this specific node should show its children
    const hasMultipleRelations =
      (direction === "right" && (data.children?.length || 0) > 1) ||
      (direction === "left" && (data.parents?.length || 0) > 1);

    const shouldShowChildren =
      depth === 0 || // Always show root
      !hasMultipleRelations || // Show if not complex
      isNodeExpanded(data.id); // Show if explicitly expanded

    // Process children for right tree
    if (direction === "right" && data.children && data.children.length > 0) {
      const processedChildren = data.children.map((child) =>
        processTree(child, "right", node, depth + 1)
      );

      if (shouldShowChildren) {
        node.children = processedChildren;
        node._children = [];
      } else {
        node.children = [];
        node._children = processedChildren;
      }
    }

    // Process parents for left tree
    if (direction === "left" && data.parents && data.parents.length > 0) {
      const processedParents = data.parents.map((parent) =>
        processTree(parent, "left", node, depth + 1)
      );

      if (shouldShowChildren) {
        node.children = processedParents;
        node._children = [];
      } else {
        node.children = [];
        node._children = processedParents;
      }
    }

    return node;
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

/**
   * Wraps text in SVG text elements with intelligent line breaking for technical identifiers
   * Splits at non-word characters like colons, underscores, dashes, dots, etc.
   */
  function wrapText(
    text: d3.Selection<SVGTextElement, any, any, any>,
    width: number,
    maxLines: number = 3,
    lineHeight: number = 1.1
  ) {
    text.each(function (d: any) {
      const textElement = d3.select(this);
      const originalText = textElement.text();

      // Clear existing text
      textElement.text(null);

      // Split on non-word characters but keep the delimiters
      // This regex splits on common technical separators: : _ - . / @ # $ % & + = ~ |
      const parts = originalText
        .split(/([:\-_./\\@#$%&+=~|])/)
        .filter((part) => part.length > 0);

      let currentLine = "";
      let lineNumber = 0;
      const dy = parseFloat(textElement.attr("dy")) || 0;
      const y = textElement.attr("y") || 0;
      const x = textElement.attr("x") || 0;

      // Create first tspan
      let tspan = textElement
        .append("tspan")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", dy + "em");

      for (let i = 0; i < parts.length && lineNumber < maxLines; i++) {
        const part = parts[i];
        const testLine = currentLine + part;

        // Set test text to measure width
        tspan.text(testLine);

        // Check if line exceeds width
        if (
          tspan.node()!.getComputedTextLength() > width &&
          currentLine.length > 0
        ) {
          // Current line is too long, start a new line
          if (lineNumber < maxLines - 1) {
            // Finalize current line
            tspan.text(currentLine);

            // Start new line
            lineNumber++;
            currentLine = part;
            tspan = textElement
              .append("tspan")
              .attr("x", x)
              .attr("dy", lineHeight + "em")
              .text(currentLine);
          } else {
            // Last line - add ellipsis if needed
            const availableText = currentLine;
            if (availableText.length > 3) {
              tspan.text(availableText.slice(0, -3) + "...");
            } else {
              tspan.text(availableText + "...");
            }
            break;
          }
        } else {
          // Line fits, continue building it
          currentLine = testLine;
        }
      }

      // Handle case where we've processed all parts but need ellipsis
      if (lineNumber >= maxLines - 1 && parts.length > 0) {
        const finalText = tspan.text();
        // Only add ellipsis if there was more content that couldn't fit
        if (currentLine !== originalText && finalText.length > 3) {
          tspan.text(finalText.slice(0, -3) + "...");
        }
      }
    });
  }

  function getLowerText(stat: LinkStats): string {
    if(Date.now() - stat.lastWrite == 0 && stat.eventCount == 0) {
      return 'N/A';
    } else if(stat.linkType === 'read') {
      if (Date.now() - stat.lastWrite < appState.botState.staleTime / 2) {
            return '-'
          } else {
            return 'lag: ' + humanize(Date.now() - stat.lastWrite);
          }
    } else {
      return humanize(Date.now() - stat.lastWrite) + ' ago';
    }
  }

/**
   * Enhanced node label creation with intelligent sizing and wrapping
   */
  function createNodeLabel(
    element: d3.Selection<SVGGElement, any, any, any>,
    d: any
  ) {
    // Determine appropriate width based on node depth and type
    let maxWidth: number = 140;
    let maxLines: number = 4;

    // Create the text element
    const textElement = element
      .append("text")
      .attr("class", "node-text")
      .attr("dy", "0.35em")
      .attr("y", nodeWidth! / 2 + 15)
      .style("text-anchor", "middle")
      .style("fill", "#333")
      .style("font-weight", d.data.depth === 0 ? "bold" : "normal")
      .style("font-size", () => {
        if (d.depth === 0) return "14px";
        if (d.depth === 1) return "12px";
        return "10px";
      })
      .text(d.data.name || d.data.id); // Set initial text

    // Apply wrapping
    wrapText(textElement, maxWidth, maxLines);

    return textElement;
  }

  function renderVisualization() {
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = 1500 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    // Create separate trees for left and right directions
    const rightRoot = processTree(relationShipTree, "right");
    const leftRoot = processTree(relationShipTree, "left");

    // Function to create tree layout and render trees
    function createTreeLayout(root: TreeNode, direction: "left" | "right") {
      const countNodes = (node: TreeNode): number => {
        let count = 1;
        if (node.children) {
          node.children.forEach((child) => {
            count += countNodes(child);
          });
        }
        return count;
      };

      const countNodesPerLevel = (
        node: TreeNode,
        level: number = 0,
        levelCounts: Record<number, number> = {}
      ) => {
        levelCounts[level] = (levelCounts[level] || 0) + 1;

        if (node.children) {
          node.children.forEach((child) => {
            countNodesPerLevel(child, level + 1, levelCounts);
          });
        }
        return levelCounts;
      };

      const totalNodes = countNodes(root);
      const levelCounts = countNodesPerLevel(root);
      const maxNodesAtAnyLevel = Math.max(...Object.values(levelCounts));

      // Calculate the dynamic height based on the number of nodes
      const dynamicHeight = Math.max(height, maxNodesAtAnyLevel * 50);

      const treeLayout = d3
        .tree()
        .nodeSize([nodeWidth! + 50, nodeWidth! + 150]);

      // Assigns x and y coordinates to each node
      const rootNode = d3.hierarchy(root);
      const treeData = treeLayout(rootNode);

      // Adjust node positions based on direction
      if (direction === "left") {
        treeData.each((d) => {
          // Flip x coordinates for left tree
          d.y = -d.y;
        });
      }

      // Translate positions to center the visualization
      const centerY = height / 2;
      const rootX = 0;

      treeData.each((d) => {
        // Swap x and y for horizontal layout
        const tempX = d.x;
        d.x = rootX + d.y;
        d.y = centerY + tempX - height / 4;
      });

      return { treeData, dynamicHeight };
    }

    // Create tree data structures
    const rightTreeResult = createTreeLayout(rightRoot, "right");
    const leftTreeResult = createTreeLayout(leftRoot, "left");
    const rightTree = rightTreeResult.treeData;
    const leftTree = leftTreeResult.treeData;

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
    const allNodes = [...rightTree.descendants(), ...leftTree.descendants()];
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
      const node1Data = findOriginalData(nodeId1);
      const node2Data = findOriginalData(nodeId2);

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

    // Add text above the link (event count)
    linkEnter
      .append("text")
      .attr("class", "link-text-above")
      .style("text-anchor", "middle")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .style("pointer-events", "none"); // Prevent text from interfering with interactions

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
      .select(".link-text-above")
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
      });

      //TODO: if 'write' then 'ago' else prepend 'lag:'
      // TODO: if lag is < 30s show '-'
      // TODO: if never read from or written to show 'N/A'
    linkUpdate
      .select(".link-text-below")
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
      .attr("transform", (d) => {
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
      createNodeLabel(element, d);

      // Add expand/collapse buttons for nodes that need them
      const hasHiddenChildren = d.data._children && d.data._children.length > 0;
      const hasVisibleChildren = d.data.children && d.data.children.length > 0;
      const originalData = findOriginalData(d.data.id);
      const hasChildrenOrParents = 
        (d.data.direction === "right" && (originalData?.children?.length || 0) > 0) ||
        (d.data.direction === "left" && (originalData?.parents?.length || 0) > 0);
      // const hasMultipleRelations =
      //   originalData &&
      //   ((d.data.direction === "right" &&
      //     (originalData.children?.length || 0) > 1) ||
      //     (d.data.direction === "left" &&
      //       (originalData.parents?.length || 0) > 1));

      // Debug logging
      if (d.data.id === relationShipTree.id) {
        // Only log for root to avoid spam
        console.log("Root node button state:", {
          hasHiddenChildren,
          hasVisibleChildren,
          // hasMultipleRelations,
          isExpanded: isNodeExpanded(d.data.id),
          originalChildrenCount: originalData?.children?.length || 0,
          originalParentsCount: originalData?.parents?.length || 0,
        });
      }

      if (hasChildrenOrParents) {
        const buttonGroup = element.append("g").attr("class", "button-group");

        const buttonCircle = buttonGroup
          .append("circle")
          .attr("class", "button-circle")
          .attr("cx", nodeWidth! / 3)
          .attr("cy", nodeWidth! / 3)
          .attr("r", 10)
          .style("stroke", "#333")
          .style("stroke-width", 1)
          .style("opacity", 0)
          .style("cursor", "pointer"); // Make button specifically clickable

        const buttonTextElement = buttonGroup
          .append("text")
          .attr("class", "button-text")
          .attr("x", nodeWidth! / 3)
          .attr("y", nodeWidth! / 3)
          .attr("dy", ".35em")
          .style("text-anchor", "middle")
          .style("fill", "black")
          .style("font-size", "18px")
          .style("font-weight", "bold")
          .style("opacity", 0)
          .style("cursor", "pointer") // Make button text clickable too
          .style("pointer-events", "none"); // But let clicks pass through to circle

        // Add click handler specifically to the button
        buttonGroup.on("click", function (event, buttonData) {
          // Stop event from bubbling to the node
          event.stopPropagation();

          toggleNode(buttonData.data.id);
        });

        // Add hover effects
        element
          .on("mouseenter", function () {
            const isExplicitlyExpanded = isNodeExpanded(d.data.id);
            const hasMultipleRelations =
              originalData &&
              ((d.data.direction === "right" && (originalData.children?.length || 0) > 1) ||
                (d.data.direction === "left" && (originalData.parents?.length || 0) > 1)); 
            let buttonText = isExplicitlyExpanded && hasHiddenChildren ? "<" : ">";

            // // Show collapse button if:
            // // 1. Node has visible children AND
            // // 2. Node has multiple relations (meaning it can be collapsed) AND
            // // 3. Node is explicitly expanded (user expanded it manually)
            // if (hasVisibleChildren && hasMultipleRelations && isExplicitlyExpanded) {
            //   buttonText = "<";
            // } 
            // // Show expand button if:
            // // 1. Node has hidden children OR
            // // 2. Node has potential to expand (multiple relations but not explicitly expanded)
            // else if (hasHiddenChildren || (hasMultipleRelations && !isExplicitlyExpanded)) {
            //   buttonText = ">";
            // }
            // // Default to expand for any expandable node
            // else {
            //   buttonText = ">";
            // }
            
            buttonCircle.style("fill", "#FFFF");
            buttonTextElement.text(buttonText);

            buttonCircle.transition().duration(200).style("opacity", 1);
            buttonTextElement.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave", function () {
            buttonCircle.transition().duration(200).style("opacity", 0);
            buttonTextElement.transition().duration(200).style("opacity", 0);
          });
      }
    });

    // Merge and update all nodes
    const nodeUpdate = nodeEnter.merge(nodeSelection);

    // Update button states for all nodes (both new and existing)
    nodeUpdate.each(function (d) {
      const element = d3.select(this);
      const buttonGroup = element.select(".button-group");

      if (!buttonGroup.empty()) {
        // Re-evaluate button state for existing buttons
        const hasHiddenChildren =
          d.data._children && d.data._children.length > 0;
        const hasVisibleChildren =
          d.data.children && d.data.children.length > 0;
        const originalData = findOriginalData(d.data.id);
        const hasMultipleRelations =
          originalData &&
          ((d.data.direction === "right" &&
            (originalData.children?.length || 0) > 1) ||
            (d.data.direction === "left" &&
              (originalData.parents?.length || 0) > 1));

        // Update the hover behavior with current state
        element
          .on("mouseenter", function () {
            const isExplicitlyExpanded = isNodeExpanded(d.data.id);
            let buttonColor, buttonText;

            // Show collapse button if:
            // 1. Node has visible children AND
            // 2. Node has multiple relations (meaning it can be collapsed) AND
            // 3. Node is explicitly expanded (user expanded it manually)
            if (hasVisibleChildren && hasMultipleRelations && isExplicitlyExpanded) {
              buttonText = "<";
            } 
            // Show expand button if:
            // 1. Node has hidden children OR
            // 2. Node has potential to expand (multiple relations but not explicitly expanded)
            else if (hasHiddenChildren || (hasMultipleRelations && !isExplicitlyExpanded)) {
              buttonText = ">";
            }
            // Default to expand for any expandable node
            else {
              buttonText = ">";
            }

            const buttonCircle = buttonGroup.select(".button-circle");
            const buttonTextElement = buttonGroup.select(".button-text");
            
            buttonCircle.style("fill", "#FFFF");
            buttonTextElement.text(buttonText);

            buttonCircle.transition().duration(200).style("opacity", 1);
            buttonTextElement.transition().duration(200).style("opacity", 1);
          })
          .on("mouseleave", function () {
            const buttonCircle = buttonGroup.select(".button-circle");
            const buttonTextElement = buttonGroup.select(".button-text");

            buttonCircle.transition().duration(200).style("opacity", 0);
            buttonTextElement.transition().duration(200).style("opacity", 0);
          });

        // Also update existing button click handlers
        const existingButtonGroup = buttonGroup.select(".button-group");
        if (!existingButtonGroup.empty()) {
          existingButtonGroup.on("click", function (event, buttonData) {
            // Stop event from bubbling to the node
            event.stopPropagation();

            // Handle expand/collapse logic
            const hasHiddenChildren =
              buttonData.data._children && buttonData.data._children.length > 0;
            const hasVisibleChildren =
              buttonData.data.children && buttonData.data.children.length > 0;

            if (hasHiddenChildren || hasVisibleChildren) {
              toggleNode(buttonData.data.id);
            }
          });
        }
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

    // Add legend (only if it doesn't exist)
    if (svg.select(".legend").empty()) {
      const legend = svg
        .append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 200}, 20)`);

      const legendItems = [
        { type: "queue", color: "#8da0cb", shape: "rect", label: "Queue" },
        { type: "bot", color: "#66c2a5", shape: "circle", label: "Bot" },
        { type: "system", color: "#fc8d62", shape: "circle", label: "System" },
        {
          type: "expand",
          color: "#4CAF50",
          shape: "circle",
          label: "Click to Expand",
        },
        {
          type: "collapse",
          color: "#f44336",
          shape: "circle",
          label: "Click to Collapse",
        },
      ];

      legendItems.forEach((item, i) => {
        const yPos = i * 25;

        if (item.shape === "rect") {
          legend
            .append("rect")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("width", 15)
            .attr("height", 15)
            .style("fill", item.color);
        } else {
          legend
            .append("circle")
            .attr("cx", 8)
            .attr("cy", yPos + 8)
            .attr("r", 7)
            .style("fill", item.color);
        }

        legend
          .append("text")
          .attr("x", 20)
          .attr("y", yPos + 12)
          .text(item.label)
          .style("font-size", "12px");
      });
    }

    setTimeout(() => {
      updateVisibleNodesFromDOM()
    }, 600);
  }


  function getVisibleNodeCount(): number {
    return appState.botState.visibleIds.length;
  }

  function resetView() {
    d3.select("#tree-container svg")
      .transition()
      .duration(750)
      .call(zoomHandler.transform, d3.zoomIdentity);

    // Reset highlighting
    nodeGroup
      .selectAll(".node")
      .classed("highlighted", false)
      .classed("faded", false);
    linkGroup
      .selectAll(".link")
      .classed("highlighted", false)
      .classed("faded", false);

    // Clear node info
    d3.select("#node-info").html("<p>Click on a node to see information</p>");
  }

  function collapseAll() {
    expandedNodes.clear();
    expandedNodes = new Set(expandedNodes);
    nodePositions.clear(); // Clear stored positions for fresh layout
    lastExpandedNode = null; // Reset expansion tracking
    renderVisualization();
  }

  function expandAll() {
    // Add all node IDs to expanded set
    function addAllNodes(tree: RelationshipTree) {
      expandedNodes.add(tree.id);
      tree.children?.forEach(addAllNodes);
      tree.parents?.forEach(addAllNodes);
    }

    addAllNodes(relationShipTree);
    expandedNodes = new Set(expandedNodes);
    renderVisualization();
  }

  </script>

  <div class="workflow-container">
  <h1>Bot and Queue Workflow Visualization</h1>
  <div class="controls">
    <button onclick={resetView}>Reset View</button>
    <button onclick={expandAll}>Expand All</button>
    <button onclick={collapseAll}>Collapse All</button>
    <button>Visible Nodes ({getVisibleNodeCount()})</button>
  </div>
  <div id="tree-container"></div>
  <div class="info-panel">
    <h3>Node Information</h3>
    <div id="node-info">
      <p>Click on a node to see information</p>
      <p><strong>Instructions:</strong></p>
      <ul>
        <li>Click node: View details and highlight connections</li>
        <li>Click green + button: Expand hidden children</li>
        <li>Click red - button: Collapse visible children</li>
        <li>Hover over nodes to reveal action buttons</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .workflow-container {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
  }

  .node {
    cursor: pointer;
  }

  .link {
    fill: none;
    stroke-width: 1px;
  }

  /* Enhanced transitions for all elements */
  .button-group circle,
  .button-group text {
    transition: opacity 0.2s ease-in-out;
  }

  .node {
    transition:
      opacity 0.3s ease-in-out,
      transform 0.3s ease-in-out;
  }

  .link-group {
    transition: opacity 0.3s ease-in-out;
  }

  /* Link text styling */
  .link-text-above {
    font-weight: bold;
    fill: #333;
  }

  .link-text-below {
    fill: #666;
    font-style: italic;
  }

  /* Highlighting styles */
  .highlighted .node-circle {
    stroke: #ff5722 !important;
    stroke-width: 3px !important;
  }

  .faded {
    opacity: 0.3;
  }

  .highlighted {
    opacity: 1;
  }

  .controls {
    margin-bottom: 20px;
  }

  .info-panel {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    max-width: 250px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .info-panel ul {
    font-size: 11px;
    margin: 10px 0 0 0;
    padding-left: 15px;
  }

  .info-panel li {
    margin-bottom: 3px;
  }

  #tree-container {
    border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9;
    min-height: 800px;
  }

  button {
    padding: 8px 16px;
    background-color: #4682b4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 10px;
  }

  button:hover {
    background-color: #36648b;
  }
</style>
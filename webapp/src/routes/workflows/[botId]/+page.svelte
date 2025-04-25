<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import * as d3 from "d3";
  import type { RelationshipTree, TreeNode } from "$lib/types.js";
  import { error } from "@sveltejs/kit";
  console.log('workflow component test');
  const { data } = $props();
  const relationShipTree = data.relationShipTree;
  // console.log(botData);
  // console.log(JSON.stringify(relationShipTree));
  console.log("number of children ", relationShipTree.children.length);
  console.log("number of parents ", relationShipTree.parents.length);
  const node_width = 75;
  const stroke_color = "#50ADE5";
  //   console.log(JSON.stringify(relationShipTree));

  onMount(() => {
    console.log("component mounted");
    const treeData = relationShipTree;
    if (!treeData) {
      error(500, "failed to generate tree data");
      return;
    }

    // Set up SVG dimensions and margins
    const margin = { top: 50, right: 120, bottom: 50, left: 120 };
    const width = 1500 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    // Create the SVG container
    const svg = d3
      .select("#tree-container")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add zoom behavior
    const zoomHandler = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        svg.attr("transform", event.transform);
      });

    d3.select("#tree-container svg").call(zoomHandler);



    // Helper function to process tree data and compute coordinates
    function processTree(
      data: RelationshipTree,
      direction: "left" | "right",
      parent: TreeNode | undefined = undefined,
      depth = 0
    ) {
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
        name: data.name || "",
        type: dataType,
        size: data.size || 100,
        parent: parent,
        depth: depth,
        direction: direction,
        children: [],
      };

      // Process children for right tree
      if (direction === "right" && data.children && data.children.length > 0) {
        node.children = data.children.map((child) =>
          processTree(child, "right", node, depth + 1)
        );
      }

      // Process parents for left tree
      if (direction === "left" && data.parents && data.parents.length > 0) {
        node.children = data.parents.map((parent) =>
          processTree(parent, "left", node, depth + 1)
        );
      }

      return node;
    }
    // Create separate trees for left and right directions
    const rightRoot = processTree(treeData, "right");
    const leftRoot = processTree(treeData, "left");

    // Function to create tree layout and render trees
    function createTreeLayout(root: TreeNode, direction: "left" | "right") {
      // Create tree layout with more space for multiple generations

      const countNodes = (node: TreeNode) => {
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
      console.log("maxNodesAtAnyLevel ", maxNodesAtAnyLevel);

      // Calculate the dynamic height based on the number of nodes
      const dynamicHeight = Math.max(height, maxNodesAtAnyLevel * 50);
      console.log("dynamic height", dynamicHeight);
      const treeLayout = d3
        .tree()
        .nodeSize([node_width + 50, node_width + 150]);
      // .size([height, width * (totalNodes / 15)])
      // .separation((a, b) => {
      //   return (a.parent == b.parent ? 1 : 2) / a.depth;
      // });

      // Assigns x and y coordinates to each node
      const rootNode = d3.hierarchy(root);
      const treeData = treeLayout(rootNode);

      // Adjust node positions based on direction
      if (direction === "left") {
        treeData.each((d) => {
          console.log("tree before change: ", d);
          console.log("left x coords ", d.x);
          // Flip x coordinates for left tree
          d.y = -d.y;
        });
      }

      // Translate positions to center the visualization
      // The key fix: use the same centerY value for both trees
      const centerY = height / 2;

      // Important: Keep rootX at 0 for both directions to ensure they connect
      const rootX = 0;
      treeData.each((d) => {
        // Swap x and y for horizontal layout
        const tempX = d.x;
        d.x = rootX + d.y;
        d.y = centerY + tempX - height / 4;
        if (direction === "left") {
          console.log("tree_name", d);
          console.log("tempX", tempX);
          console.log("centerY", centerY);
          console.log("left x coords after change ", d.x);
          console.log("left y coords after change ", d.y);
        }
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

    // Draw links
    const linkGroup = svg
      .selectAll(".link-group")
      .data(allLinks)
      .enter()
      .append("g")
      .attr("class", "link-group");

    // Add the actual links
    linkGroup
      .append("path")
      .attr("class", "link")
      .attr("d", (d) => {
        // Create curved links
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        return `M${sourceX},${sourceY}
                C${(sourceX + targetX) / 2},${sourceY}
                 ${(sourceX + targetX) / 2},${targetY}
                 ${targetX},${targetY}`;

      })
      .style("stroke", stroke_color)
      .style("stroke-width", "2px")
      .style("fill", "none");

    // Add relationship labels
    linkGroup
      .append("text")
      .attr("class", "link-label")
      .attr("dy", -8)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#555")
      .attr("transform", (d) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        return `translate(${midX},${midY})`;
      })
      // .text(d => {
      //     // Different labels based on node types and direction
      //     const sourceType = d.source.data.type;
      //     const targetType = d.target.data.type;

      //     if (d.source.data.direction === "right") {
      //         if (sourceType === "queue" && targetType === "bot") return "Read by";
      //         if (sourceType === "bot" && targetType === "queue") return "Writes to";
      //     } else {
      //         if (sourceType === "queue" && targetType === "bot") return "Written by";
      //         if (sourceType === "bot" && targetType === "queue") return "Reads from";
      //     }
      //     return "";
      // })
      .style("font-size", (d) => (d.target.depth > 1 ? "8px" : "10px")); // Smaller text for deeper generations

    // Draw nodes
    const node = svg
      .selectAll(".node")
      .data(allNodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .on("click", (event, d) => {
        // Display node information
        d3.select("#node-info").html(`
                        <p><strong>ID:</strong> ${d.data.id}</p>
                        <p><strong>Type:</strong> ${d.data.type}</p>
                        <p><strong>Generation:</strong> ${d.depth === 0 ? "Root" : d.depth === 1 ? "1st" : d.depth === 2 ? "2nd" : "3rd"}</p>
                        <p><strong>Direction:</strong> ${d.data.direction}</p>
                    `);

        // Highlight connected nodes
        highlightConnections(d);
      });

    // Function to highlight connections
    function highlightConnections(
      selectedNode: d3.HierarchyPointNode<unknown>
    ) {
      // Reset all nodes and links
      d3.selectAll(".node")
        .classed("highlighted", false)
        .classed("faded", false);
      d3.selectAll(".link")
        .classed("highlighted", false)
        .classed("faded", true);

      // Highlight the selected node
      d3.selectAll(".node")
        .filter((d) => d.data.id === selectedNode.data.id)
        .classed("highlighted", true)
        .classed("faded", false);

      // Highlight directly connected links and nodes
      d3.selectAll(".link").each(function (d) {
        if (
          d.source.data.id === selectedNode.data.id ||
          d.target.data.id === selectedNode.data.id
        ) {
          d3.select(this).classed("highlighted", true).classed("faded", false);

          // Highlight connected nodes
          d3.selectAll(".node")
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

    // Add shapes to nodes based on type
    node.each(function (d) {
      const element = d3.select(this);

      element
        .append("circle")
        .attr("r", (d) => node_width / 2)
        .style("fill", (d) => {
          return "#FFFF";
        })
        .style("stroke", (d) => {
          return stroke_color;
        })
        .style("stroke-width", (d) => (d.data.depth === 0 ? 8 : 2));

      if (d.data.type === "queue") {
        // Queues are rectangles
        // element
        //   .append("rect")
        //   .attr("x", -50)
        //   .attr("y", -20)
        //   .attr("width", 100)
        //   .attr("height", 40)
        //   .attr("rx", 5)
        //   .attr("ry", 5)
        //   .style("fill", "#9467bd")
        //   .style("stroke", "#333")
        //   .style("stroke-width", d.data.depth === 0 ? 3 : 1.5)
        //   .attr("class", "node-shape");
        element
          .append("image")
          .attr("xlink:href", "/queue.png")
          .attr("x", -node_width / 2)
          .attr("y", -node_width / 2)
          .attr("height", node_width)
          .attr("width", node_width);
      } else if (d.data.type === "bot") {
        // Bots are circles
        element
          .append("image")
          .attr("xlink:href", "/bot.png")
          .attr("x", -node_width / 2)
          .attr("y", -node_width / 2)
          .attr("height", node_width)
          .attr("width", node_width);

        // element
        //   .append("circle")
        //   .attr("r", (d) =>
        //     Math.max(10, Math.min(20, (d.data.size || 100) / 5 - d.depth * 2))
        //   )
        //   .style("fill", "#fc8d62")
        //   .style("stroke", "#333")
        //   .style("stroke-width", 1.5)
        //   .attr("class", "node-shape");
      } else {
        element
          .append("image")
          .attr("xlink:href", "/system.png")
          .attr("x", -node_width / 2)
          .attr("y", -node_width / 2)
          .attr("height", node_width)
          .attr("width", node_width);
      }
    });

    // Add text labels to nodes
    node
      .append("text")
      .attr("dy", ".35em")
      .attr("y", node_width / 2)
      .style("text-anchor", (d) => {
        // Align text differently based on direction and type
        // if (d.data.type === "queue") return "middle";
        // return d.data.direction === "left" ? "end" : "start";
        return "middle";
      })
      .text((d) => d.data.id)
      .style("fill", "#333")
      .style("font-weight", (d) => (d.data.depth === 0 ? "bold" : "normal"))
      .style("font-size", (d) => {
        // Smaller font for deeper generations
        if (d.depth === 0) return "14px";
        if (d.depth === 1) return "12px";
        return "10px";
      });

    // Reset view button
    d3.select("#resetBtn").on("click", () => {
      d3.select("#tree-container svg")
        .transition()
        .duration(750)
        .call(zoomHandler.transform, d3.zoomIdentity);

      // Reset highlighting
      d3.selectAll(".node")
        .classed("highlighted", false)
        .classed("faded", false);
      d3.selectAll(".link")
        .classed("highlighted", false)
        .classed("faded", false);
    });

    // Legend
    const legend = svg
      .append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 150}, 20)`);

    // Queue legend
    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 20)
      .attr("height", 15)
      .attr("rx", 2)
      .attr("ry", 2)
      .style("fill", "#8da0cb");

    legend
      .append("text")
      .attr("x", 25)
      .attr("y", 12)
      .text("Queue")
      .style("font-size", "12px");

    // Bot legend
    legend
      .append("circle")
      .attr("cx", 10)
      .attr("cy", 40)
      .attr("r", 8)
      .style("fill", "#66c2a5");

    legend
      .append("text")
      .attr("x", 25)
      .attr("y", 44)
      .text("Bot")
      .style("font-size", "12px");

    // Generation legend
    legend
      .append("line")
      .attr("x1", 0)
      .attr("y1", 70)
      .attr("x2", 20)
      .attr("y2", 70)
      .style("stroke", "#333")
      .style("stroke-width", 2);

    legend
      .append("text")
      .attr("x", 25)
      .attr("y", 74)
      .text("1st Generation")
      .style("font-size", "12px");

    legend
      .append("line")
      .attr("x1", 0)
      .attr("y1", 90)
      .attr("x2", 20)
      .attr("y2", 90)
      .style("stroke", "#333")
      .style("stroke-width", 1.5)
      .style("stroke-dasharray", "5,5");

    legend
      .append("text")
      .attr("x", 25)
      .attr("y", 94)
      .text("2nd/3rd Generation")
      .style("font-size", "12px");
  });
</script>

<div class="workflow-container">
  <h1>Bot and Queue Workflow Visualization</h1>
  <div class="controls">
    <button id="resetBtn">Reset View</button>
  </div>
  <div id="tree-container"></div>
  <div class="info-panel">
    <h3>Node Information</h3>
    <div id="node-info">
      <p>Click on a node to see information</p>
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

  /* Highlighting styles */
  .highlighted .node-shape {
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
    max-width: 200px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  #tree-container {
    border: 1px solid #ddd;
    border-radius: 5px;
    background-color: #f9f9f9;
    min-height: 800px;
    /* overflow: auto; */
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

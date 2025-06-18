import type { TreeNode } from "$lib/types";
import * as d3 from "d3";
import type { TreeLayoutResult } from "./types";

/**
 * Wraps text in SVG text elements with intelligent line breaking for technical identifiers
 * Splits at non-word characters like colons, underscores, dashes, dots, etc.
 */
export function wrapText(
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

/**
 * Enhanced node label creation with intelligent sizing and wrapping
 */
export function createNodeLabel(
  nodeWidth: number,
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
    .attr("y", nodeWidth / 2 + 15)
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

export function setupZoomBehavior(
  svg: d3.Selection<SVGGElement, unknown, HTMLElement, any>
) {
  return d3
    .zoom()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });
}

// Function to create tree layout and render trees
export function createTreeLayout(root: TreeNode, direction: "left" | "right", height: number, nodeWidth: number): TreeLayoutResult {
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

  const treeLayout = d3.tree().nodeSize([nodeWidth + 50, nodeWidth + 150]);

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

// function resetView() {
//     d3.select("#tree-container svg")
//       .transition()
//       .duration(750)
//       .call(zoomHandler.transform, d3.zoomIdentity);

//     // Reset highlighting
//     nodeGroup
//       .selectAll(".node")
//       .classed("highlighted", false)
//       .classed("faded", false);
//     linkGroup
//       .selectAll(".link")
//       .classed("highlighted", false)
//       .classed("faded", false);

//     // Clear node info
//     d3.select("#node-info").html("<p>Click on a node to see information</p>");
//   }

//   function collapseAll() {
//     expandedNodes.clear();
//     expandedNodes = new Set(expandedNodes);
//     nodePositions.clear(); // Clear stored positions for fresh layout
//     lastExpandedNode = null; // Reset expansion tracking
//     renderVisualization();
//   }

//   function collapseToRoot() {
//     // Clear all expanded nodes to show only the root
//     expandedNodes.clear();
//     expandedNodes = new Set(expandedNodes);
//     nodePositions.clear();
//     lastExpandedNode = null;
//     renderVisualization();
//   }

//   function expandAll() {
//     // Add all node IDs to expanded set for both children and parents
//     function addAllNodes(tree: RelationshipTree) {
//       expandedNodes.add(`${tree.id}-children`);
//       expandedNodes.add(`${tree.id}-parents`);
//       tree.children?.forEach(addAllNodes);
//       tree.parents?.forEach(addAllNodes);
//     }

//     addAllNodes(relationShipTree);
//     expandedNodes = new Set(expandedNodes);
//     renderVisualization();
//   }


import type { TreeNode } from "$lib/types";
import * as d3 from "d3";
import type { TreeLayoutResult } from "./types";
import { mount, unmount } from "svelte";

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
    .style("fill", "var(--color-foreground)")
    .style("font-weight", d.data.depth === 0 ? "bold" : "600")
    .style("font-size", () => {
      if (d.depth === 0) return "15px";
      if (d.depth === 1) return "13px";
      return "12px";
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

  // Calculate dynamic spacing based on node density
  const baseVerticalSpacing = nodeWidth + 20; // Minimum spacing
  const baseHorizontalSpacing = nodeWidth + 80; // Minimum level spacing
  
  // Adjust spacing based on node density - more nodes = tighter spacing
  const densityFactor = Math.min(1, 10 / maxNodesAtAnyLevel); // More dense = smaller factor
  const verticalSpacing = baseVerticalSpacing + (30 * densityFactor); // 20-50px additional
  const horizontalSpacing = baseHorizontalSpacing + (70 * densityFactor); // 80-150px additional

  const treeLayout = d3.tree<TreeNode>().nodeSize([verticalSpacing, horizontalSpacing]);
  const rootNode = d3.hierarchy(root);
  const treeData = treeLayout(rootNode);
  minimizeCrossings(treeData);
  
  // Align single children with their parents
  alignSingleChildren(treeData);

  // Calculate dynamic height based on actual node spread
  const allNodes = treeData.descendants();
  const yPositions = allNodes.map(d => d.x); // Note: x and y are swapped in D3 tree
  const minY = Math.min(...yPositions);
  const maxY = Math.max(...yPositions);
  const actualSpread = maxY - minY;
  
  // Dynamic height with padding
  const dynamicHeight = Math.max(height, actualSpread + verticalSpacing * 2);

  // Adjust node positions based on direction
  if (direction === "left") {
    treeData.each((d) => {
      // Flip x coordinates for left tree
      d.y = -d.y;
    });
  }

  // Center the tree in the available space
  const centerY = dynamicHeight / 2;
  
  // Calculate the actual center of the tree nodes
  const rootOriginalPos = rootNode.x;
  const treeCenter = (minY + maxY) / 2;

  treeData.each((d) => {
    // Swap x and y for horizontal layout and center properly
    const tempX = d.x;
    d.x = d.y;
    d.y = centerY + (tempX - treeCenter);
  });

  return { treeData, dynamicHeight };
}


function alignSingleChildren(treeData: d3.HierarchyPointNode<TreeNode>) {
  // Align single children with their parents to avoid visual misalignment
  treeData.descendants().forEach(node => {
    if (node.children && node.children.length === 1) {
      const child = node.children[0];
      // Align the single child's vertical position with its parent
      child.x = node.x;
    }
  });
}

function minimizeCrossings(treeData: d3.HierarchyPointNode<TreeNode>) {
  // Group nodes by depth level
  const nodesByLevel = new Map<number, d3.HierarchyPointNode<TreeNode>[]>();
  
  treeData.descendants().forEach(node => {
    const level = node.depth;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });

  // Process each level (except root) to minimize crossings
  for (let level = 1; level <= Math.max(...nodesByLevel.keys()); level++) {
    const currentLevelNodes = nodesByLevel.get(level) || [];
    const parentLevelNodes = nodesByLevel.get(level - 1) || [];
    
    if (currentLevelNodes.length <= 1) continue;
    
    // Enhanced sorting that considers both parent position and node relationships
    currentLevelNodes.sort((a, b) => {
      const aParentY = a.parent?.x || 0;
      const bParentY = b.parent?.x || 0;
      
      // Primary sort: by parent position
      const parentDiff = aParentY - bParentY;
      if (Math.abs(parentDiff) > 50) { // Only use parent position if significantly different
        return parentDiff;
      }
      
      // Secondary sort: group nodes with similar IDs together
      const aId = (a.data as any).originalId || (a.data as any).id || '';
      const bId = (b.data as any).originalId || (b.data as any).id || '';
      
      // Extract base name for grouping (remove prefixes and suffixes)
      const getBaseName = (id: string) => {
        return id.replace(/^(bot:|queue:|system:)/, '').split('-')[0];
      };
      
      const aBase = getBaseName(aId);
      const bBase = getBaseName(bId);
      
      if (aBase !== bBase) {
        return aBase.localeCompare(bBase);
      }
      
      // Tertiary sort: by full ID
      return aId.localeCompare(bId);
    });
    
    // Redistribute the sorted nodes with better spacing
    const originalPositions = currentLevelNodes.map(n => n.x);
    const minPos = Math.min(...originalPositions);
    const maxPos = Math.max(...originalPositions);
    const totalSpread = maxPos - minPos;
    
    // Use original spacing if it's reasonable, otherwise create even spacing
    if (totalSpread > 0 && currentLevelNodes.length > 1) {
      const spacing = totalSpread / (currentLevelNodes.length - 1);
      currentLevelNodes.forEach((node, index) => {
        node.x = minPos + (index * spacing);
      });
    }
  }
}

export function createLucideIconComponent(
  parent: d3.Selection<any, any, any, any>,
  IconComponent: any,
  x: number,
  y: number,
  size: number = 16,
  className: string = ''
) {
  // Create foreignObject container
  const foreignObject = parent
    .append('foreignObject')
    .attr('x', x - size/2)
    .attr('y', y - size/2)
    .attr('width', size)
    .attr('height', size)
    .attr('class', `lucide-icon-container ${className}`)
    .style('pointer-events', 'none')
    .style('opacity', 0);

  // Create a div inside the foreignObject
  const div = foreignObject
    .append('xhtml:div')
    .style('width', '100%')
    .style('height', '100%')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('justify-content', 'center');

  // Mount the Svelte component
  const iconContainer = div.node() as HTMLElement;
  const iconInstance = mount(IconComponent, {
    target: iconContainer,
    props: {
      size: size,
      class: 'lucide-d3-icon'
    }
  });

  return {
    foreignObject,
    iconInstance,
    destroy: () => {
      unmount(iconInstance);
      foreignObject.remove();
    }
  };
}

export function createLucideIconFromComponent(
  parent: d3.Selection<any, any, any, any>,
  IconComponent: any,
  x: number,
  y: number,
  size: number = 16,
  className: string = ''
) {
  // Create a temporary container to render the icon
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  document.body.appendChild(tempContainer);

  // Mount the icon component temporarily
  const iconInstance = mount(IconComponent, {
    target: tempContainer,
    props: { size: size }
  });

  // Extract the SVG content
  const svgElement = tempContainer.querySelector('svg');
  if (!svgElement) {
    console.error('Could not find SVG in Lucide component');
    document.body.removeChild(tempContainer);
    return null;
  }

  // Clone the SVG content
  const svgContent = svgElement.innerHTML;
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 24 24';

  // Cleanup temporary elements
  unmount(iconInstance);
  document.body.removeChild(tempContainer);

  // Create the icon group in D3
  const iconGroup = parent
    .append('g')
    .attr('class', `lucide-icon ${className}`)
    .attr('transform', `translate(${x}, ${y})`);

  // Add the SVG content
  const svg = iconGroup
    .append('svg')
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', viewBox)
    .attr('x', -size/2)
    .attr('y', -size/2)
    .style('overflow', 'visible')
    .html(svgContent);

  // Apply Lucide's default styles
  svg.selectAll('*')
    .style('fill', 'none')
    .style('stroke', 'currentColor')
    .style('stroke-width', 2)
    .style('stroke-linecap', 'round')
    .style('stroke-linejoin', 'round');

  return iconGroup;
}
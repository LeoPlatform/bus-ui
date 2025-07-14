import type { MergedStatsRecord, RelationshipTree, TreeNode } from "$lib/types";
import type { LinkStats } from "./types";
import * as d3 from 'd3';

export function processTree(
  data: RelationshipTree,
  direction: "left" | "right",
  expandedNodes: Set<string>,
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

  // Determine if this specific node should show its children/parents
  const hasMultipleRelations =
    (direction === "right" && (data.children?.length || 0) > 1) ||
    (direction === "left" && (data.parents?.length || 0) > 1);

  // Default expansion logic: show children/parents until we hit a node with multiple relations
  // OR if the user has explicitly expanded/collapsed via buttons
  const isExplicitlyExpanded =
    (direction === "right" && expandedNodes.has(`${data.id}-children`)) ||
    (direction === "left" && expandedNodes.has(`${data.id}-parents`));

  const isExplicitlyCollapsed =
    (direction === "right" &&
      expandedNodes.has(`${data.id}-children-collapsed`)) ||
    (direction === "left" && expandedNodes.has(`${data.id}-parents-collapsed`));

  const shouldShowChildren =
    isExplicitlyExpanded || // User explicitly expanded
    (!isExplicitlyCollapsed && !hasMultipleRelations); // Default: show unless multiple relations or explicitly collapsed

  // Process children for right tree
  if (direction === "right" && data.children && data.children.length > 0) {
    const processedChildren = data.children.map((child) =>
      processTree(child, "right", expandedNodes, node, depth + 1)
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
      processTree(parent, "left", expandedNodes, node, depth + 1)
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

export function initializeLinkStats(
  botStats: MergedStatsRecord[],
  linkStats: Map<string, LinkStats>
) {
  // console.log("initializeLinkStats called, botStats length:", botStats.length);
  // console.log("botStats:", botStats);
  if (!botStats || botStats.length === 0) {
    // console.log("botStats is empty or undefined");
    return;
  }

  // Convert the botStats proxy object into an array
  const statsArray = botStats;
  // console.log("botStats to array:", statsArray);

  if (statsArray.length === 0) {
    return;
  }

  linkStats.clear();

  statsArray.forEach((stat: MergedStatsRecord) => {
    $state.snapshot(stat);
    let idKey = stat.id;
    if (stat.read) {
      // console.log('found read stats');
      Object.entries(stat.read).forEach(([childId, readStat]) => {
        let key = `${idKey}-${childId}`;
        linkStats.set(key, {
          eventCount: readStat.units,
          lastWrite: new Date(readStat.timestamp).getTime(),
          linkType: "read",
        });
      });
    }
    if (stat.write) {
      // console.log('found write stats');
      Object.entries(stat.write).forEach(([parentId, writeStat]) => {
        let key = `${parentId}-${idKey}`;
        linkStats.set(key, {
          eventCount: writeStat.units,
          lastWrite: new Date(writeStat.timestamp).getTime(),
          linkType: "write",
        });
      });
    }
  });

  linkStats = new Map(linkStats);
}

export function findOriginalData(tree: RelationshipTree, nodeId: string): RelationshipTree | null {
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

  return search(tree);
}

export function toggleNodeExpansion(
    nodeId: string,
    type: 'children' | 'parents',
    nodes: Set<string>,
    tree: RelationshipTree
): {expandedNodes: Set<string>, lastExpandedNode: string} {
    
    
    const isCurrentlyExpanded = nodes.has(`${nodeId}-${type}`);
    const isCurrentlyCollapsed = nodes.has(`${nodeId}-${type}-collapsed`);
    
    // Clear both states first
    nodes.delete(`${nodeId}-${type}`);
    nodes.delete(`${nodeId}-${type}-collapsed`);
    
    if (isCurrentlyExpanded) {
      // Was expanded, now collapse it
      nodes.add(`${nodeId}-${type}-collapsed`);
      handleBackgroundNodeCircles(nodeId, 'expand');
      console.log(`Collapsed ${type} for node:`, nodeId);
    } else if (isCurrentlyCollapsed) {
      // Was collapsed, now expand it
      nodes.add(`${nodeId}-${type}`);
      handleBackgroundNodeCircles(nodeId, 'contract');
      console.log(`Expanded ${type} for node:`, nodeId);
    } else {
      // Default state - determine what to do based on current visibility
      const originalData = findOriginalData(tree, nodeId);
      const hasMultipleRelationships = (originalData?.[type]?.length || 0) > 1;
      
      if (hasMultipleRelationships) {
        // Multiple parents/children exist but not shown by default, so expand
        nodes.add(`${nodeId}-${type}`);
        handleBackgroundNodeCircles(nodeId, 'contract');
        console.log(`Expanded ${type} for node:`, nodeId);
      } else {
        // Single relationship chain shown by default, so collapse
        nodes.add(`${nodeId}-${type}-collapsed`);
        handleBackgroundNodeCircles(nodeId, 'expand');
        console.log(`Collapsed ${type} for node:`, nodeId);
      }
    }
    
    return {expandedNodes: new Set(nodes), lastExpandedNode: nodeId};
}

export function processTreeSimple(
  data: RelationshipTree,
  direction: "left" | "right",
  expandedNodes: Set<string>,
  parent: TreeNode | undefined = undefined,
  depth = 0,
  relationshipPath: string[] = [] // Track the path to ensure uniqueness
): TreeNode {
  let dataType: "queue" | "system" | "bot";
  if (data.id.startsWith("queue:")) {
    dataType = "queue";
  } else if (data.id.startsWith("system:")) {
    dataType = "system";
  } else {
    dataType = "bot";
  }

  // Create unique ID based on relationship path to avoid duplicates
  const uniqueId = relationshipPath.length > 0 
    ? `${data.id}-${relationshipPath.join('-')}-${depth}`
    : data.id;

  const node: TreeNode = {
    id: uniqueId,
    originalId: data.id, // Keep original ID for data lookups
    name: data.name || data.id,
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

  // Prevent infinite loops by checking relationship path
  if (relationshipPath.includes(data.id)) {
    return node; // Don't process further to avoid cycles
  }

  const newPath = [...relationshipPath, data.id];

  // Determine if this specific node should show its children/parents
  const hasMultipleRelations =
    (direction === "right" && (data.children?.length || 0) > 1) ||
    (direction === "left" && (data.parents?.length || 0) > 1);

  const isExplicitlyExpanded =
    (direction === "right" && expandedNodes.has(`${data.id}-children`)) ||
    (direction === "left" && expandedNodes.has(`${data.id}-parents`));

  const isExplicitlyCollapsed =
    (direction === "right" && expandedNodes.has(`${data.id}-children-collapsed`)) ||
    (direction === "left" && expandedNodes.has(`${data.id}-parents-collapsed`));

  const shouldShowChildren =
    isExplicitlyExpanded || 
    (!isExplicitlyCollapsed && !hasMultipleRelations);

  // Process children for right tree
  if (direction === "right" && data.children && data.children.length > 0) {
    const processedChildren = data.children.map((child, index) =>
      processTreeSimple(
        child, 
        "right", 
        expandedNodes, 
        node, 
        depth + 1,
        [...newPath, `child-${index}`] // Add index to ensure uniqueness
      )
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
    const processedParents = data.parents.map((parent, index) =>
      processTreeSimple(
        parent, 
        "left", 
        expandedNodes, 
        node, 
        depth + 1,
        [...newPath, `parent-${index}`] // Add index to ensure uniqueness
      )
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

// Helper function to get original ID for data lookups
export function getOriginalNodeId(node: TreeNode): string {
  return (node as any).originalId || node.id;
}

export function adjustForCollisions(treeData: d3.HierarchyPointNode<TreeNode>, nodeWidth: number) {
  const nodes = treeData.descendants();
  const nodeRadius = nodeWidth / 2 + 10; // Add some padding
  
  // Group nodes by depth level
  const nodesByLevel = new Map<number, d3.HierarchyPointNode<TreeNode>[]>();
  nodes.forEach(node => {
    const level = node.depth;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });
  
  // Adjust positions within each level to prevent overlaps
  nodesByLevel.forEach((levelNodes, level) => {
    if (levelNodes.length <= 1) return;
    
    // Sort nodes by their y position
    levelNodes.sort((a, b) => a.y - b.y);
    
    // Adjust positions to prevent overlaps
    for (let i = 1; i < levelNodes.length; i++) {
      const currentNode = levelNodes[i];
      const previousNode = levelNodes[i - 1];
      
      const minDistance = nodeRadius * 2;
      const currentDistance = currentNode.y - previousNode.y;
      
      if (currentDistance < minDistance) {
        const adjustment = minDistance - currentDistance;
        currentNode.y += adjustment;
        
        // Propagate adjustment to subsequent nodes
        for (let j = i + 1; j < levelNodes.length; j++) {
          levelNodes[j].y += adjustment;
        }
      }
    }
  });
}

/**
 * Handles the expansion and contraction of the background circles around nodes.
 * 
 * @param nodeId The id of the node generally the botId or queueId
 * @param type The type of action, expand or contract
 */
export function handleBackgroundNodeCircles(nodeId: string, type: 'expand' | 'contract') {
  const nodeNewIdentifier = '.'+createGoodIdentifier('unexpanded-circle-group-', nodeId);
  const element = d3.select(nodeNewIdentifier);
  if(type == 'expand') {
    element.selectChildren().attr('r', 37.5);

  } else {
    element.selectChildren().attr('r', 1e-6);
  }
}


export function createGoodIdentifier(prefix: string, nodeId: string): string {
  const re = /[^a-zA-Z_-]/gm;
  return `${prefix}${nodeId}`.replace(re, '-');
}
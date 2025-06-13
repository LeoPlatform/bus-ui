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
  console.log("initializeLinkStats called, botStats length:", botStats.length);
  console.log("botStats:", botStats);
  if (!botStats || botStats.length === 0) {
    console.log("botStats is empty or undefined");
    return;
  }

  // Convert the botStats proxy object into an array
  const statsArray = botStats;
  console.log("botStats to array:", statsArray);

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

/**
 * Handles the expansion and contraction of the background circles around nodes.
 * 
 * @param nodeId The id of the node generally the botId or queueId
 * @param type The type of action, expand or contract
 */
export function handleBackgroundNodeCircles(nodeId: string, type: 'expand' | 'contract') {
  const element = d3.select(`.unexpanded-circle-group-${nodeId.replace(':', '-')}`);
  if(type == 'expand') {
    element.selectChildren().attr('r', 37.5);

  } else {
    element.selectChildren().attr('r', 1e-6);
  }
}

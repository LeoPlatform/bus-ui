import type { MergedStatsRecord, RelationshipTree, TreeNode } from "$lib/types";
import { DEFAULT_FILTER_OPTIONS, type FilterOptions, type LinkStats, type RelationshipScore } from "./types";
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
    archived: data.archived,
    status: data.status,
    isAlarmed: data.isAlarmed,
    alarms: data.alarms,
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
    // console.log("botStats is empty or undefined");
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
    let idKey = stat.id.replace(/^(bot:|queue:|system:)/, ''); // Remove prefixes
    if (stat.read) {
      // console.log('found read stats');
      Object.entries(stat.read).forEach(([childId, readStat]) => {
        let cleanChildId = childId.replace(/^(bot:|queue:|system:)/, '');
        let key = `${idKey}-${cleanChildId}`;
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
        let cleanParentId = parentId.replace(/^(bot:|queue:|system:)/, '');
        let key = `${cleanParentId}-${idKey}`;
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

export function processTreeVerySimple(
  data: RelationshipTree,
  direction: "left" | "right",
  expandedNodes: Set<string>,
  parent: TreeNode | undefined = undefined,
  depth: number = 0
): TreeNode {
  let dataType: "bot" | "queue" | "system";
  if (data.id.startsWith("bot:")) {
    dataType = "bot";
  } else if (data.id.startsWith("queue:")) {
    dataType = "queue";
  } else {
    dataType = "system";
  }

  const node: TreeNode = {
    id: data.id, // Use original ID - no path-based uniqueness
    originalId: data.id,
    name: data.name || data.id,
    type: dataType,
    paused: data.paused,
    alarmed: data.alarmed,
    rogue: data.rogue,
    archived: data.archived,
    status: data.status,
    isAlarmed: data.isAlarmed,
    alarms: data.alarms,
    parent: parent,
    depth: depth,
    direction: direction,
    children: [],
    _children: [],
  };

  // Simple expansion logic - just show first level by default
  if (direction === "right" && data.children && data.children.length > 0) {
    const shouldExpand = expandedNodes.has(`${data.id}-children`) || 
                        (data.children.length <= 1 && !expandedNodes.has(`${data.id}-children-collapsed`));
    
    if (shouldExpand) {
      node.children = data.children.slice(0, 5).map(child => // Limit to 5 to avoid deep trees
        processTreeVerySimple(child, direction, expandedNodes, node, depth + 1)
      );
    }
  }

  if (direction === "left" && data.parents && data.parents.length > 0) {
    const shouldExpand = expandedNodes.has(`${data.id}-parents`) || 
                        (data.parents.length <= 1 && !expandedNodes.has(`${data.id}-parents-collapsed`));
    
    if (shouldExpand) {
      node.children = data.parents.slice(0, 5).map(parent => // Limit to 5 to avoid deep trees
        processTreeVerySimple(parent, direction, expandedNodes, node, depth + 1)
      );
    }
  }

  return node;
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
    archived: data.archived,
    status: data.status,
    isAlarmed: data.isAlarmed,
    alarms: data.alarms,
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

/**
 * Calculate importance score for relationships based on multiple factors
 */
export function calculateRelationshipImportance(
  relationship: RelationshipTree,
  linkStats: Map<string, LinkStats>,
  parentId: string,
  direction: 'children' | 'parents'
): RelationshipScore {
  const childId = relationship.id;
  const key = direction === 'children' ? `${parentId}-${childId}` : `${childId}-${parentId}`;
  const stats = linkStats.get(key) || { eventCount: 0, lastWrite: undefined, lastRead: undefined, linkType: direction === 'children' ? 'read' : 'write' };
  // if(!stats) {
  //   throw new Error(`no stats found for relationship: ${key} | ${direction}`);
  // }
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const timeSinceLastActivity = now - (stats.lastWrite! || stats.lastRead!);

  // console.log('timeSinceLastActivity:', timeSinceLastActivity, 'stats.lastWrite:', stats.lastWrite, 'stats.lastRead:', stats.lastRead);
  
  // Base importance factors
  const eventWeight = Math.log(stats.eventCount + 1) * 10; // Logarithmic scaling for event count
  const recencyWeight = Math.max(0, 100 - (timeSinceLastActivity / dayMs)); // Decay over days
  const typeWeight = stats.linkType === 'write' ? 20 : 10; // Writers are more important
  
  // Special conditions
  const isRecent = timeSinceLastActivity < (2 * dayMs); // Active in last 2 days
  const isPriority = relationship.alarmed || relationship.isAlarmed || relationship.rogue || stats.eventCount > 100;
  
  // Bonus points based on status
  let bonusPoints = 0;
  if (relationship.status === 'danger') bonusPoints += 75;
  if (relationship.status === 'rogue') bonusPoints += 50;
  if (relationship.status === 'blocked') bonusPoints += 40;
  if (relationship.alarmed || relationship.isAlarmed) bonusPoints += 50;
  if (relationship.rogue) bonusPoints += 30;
  if (relationship.paused) bonusPoints -= 20; // Paused items are less important
  if (relationship.archived) bonusPoints -= 50; // Archived items are less important
  if (isRecent) bonusPoints += 25;

  // console.log('eventWeight:', eventWeight, 'recencyWeight:', recencyWeight, 'typeWeight:', typeWeight, 'bonusPoints:', bonusPoints);
  
  const totalScore = eventWeight + recencyWeight + typeWeight + bonusPoints;

  // console.log('totalScore for ', relationship.id, totalScore);
  
  return {
    id: relationship.id,
    score: totalScore,
    lastActivity: stats.lastWrite || stats.lastRead,
    eventCount: stats.eventCount,
    isRecent,
    isPriority
  };
}

/**
 * Filter and sort relationships based on importance and user preferences
 */
export function filterRelationshipsByImportance(
  relationships: RelationshipTree[],
  linkStats: Map<string, LinkStats>,
  parentId: string,
  direction: 'children' | 'parents',
  filterOptions: FilterOptions = DEFAULT_FILTER_OPTIONS
): RelationshipTree[] {
  if (!relationships || relationships.length === 0) return [];
  
  // Calculate importance scores
  const scoredRelationships = relationships.map(rel => ({
    relationship: rel,
    score: calculateRelationshipImportance(rel, linkStats, parentId, direction)
  }));
  
  // Apply search filter
  let filtered = scoredRelationships;
  if (filterOptions.searchTerm) {
    const searchLower = filterOptions.searchTerm.toLowerCase();
    filtered = filtered.filter(item => 
      item.relationship.name?.toLowerCase().includes(searchLower) ||
      item.relationship.id.toLowerCase().includes(searchLower)
    );
  }
  
  // Apply activity filter
  if (!filterOptions.includeInactive) {
    filtered = filtered.filter(item => item.score.eventCount > 0 || item.score.isRecent);
  }
  
  // Sort by user preference
  filtered.sort((a, b) => {
    switch (filterOptions.sortBy) {
      case 'importance':
        return b.score.score - a.score.score;
      case 'recent':
        return b.score.lastActivity - a.score.lastActivity;
      case 'activity':
        return b.score.eventCount - a.score.eventCount;
      case 'alphabetical':
        return (a.relationship.name || a.relationship.id).localeCompare(
          b.relationship.name || b.relationship.id
        );
      default:
        return b.score.score - a.score.score;
    }
  });
  
  // Take top N relationships
  const topRelationships = filtered.slice(0, filterOptions.showCount);
  
  return topRelationships.map(item => item.relationship);
}

/**
 * Enhanced tree processing with importance-based filtering
 */
export function processTreeWithImportanceFiltering(
  data: RelationshipTree,
  direction: "left" | "right",
  expandedNodes: Set<string>,
  linkStats: Map<string, LinkStats>,
  filterOptions: Map<string, FilterOptions> = new Map(),
  parent: TreeNode | undefined = undefined,
  depth = 0,
  relationshipPath: string[] = []
): TreeNode {
  let dataType: "queue" | "system" | "bot";
  if (data.id.startsWith("queue:")) {
    dataType = "queue";
  } else if (data.id.startsWith("system:")) {
    dataType = "system";
  } else {
    dataType = "bot";
  }

  // Use original ID for positioning, but track cycles with relationshipPath
  const node: TreeNode = {
    id: data.id, // Use original ID for clean positioning
    originalId: data.id,
    name: data.name || data.id,
    type: dataType,
    paused: data.paused,
    alarmed: data.alarmed,
    rogue: data.rogue,
    archived: data.archived,
    status: data.status,
    isAlarmed: data.isAlarmed,
    alarms: data.alarms,
    parent: parent,
    depth: depth,
    direction: direction,
    children: [],
    _children: [],
  };

  // Prevent infinite loops
  if (relationshipPath.includes(data.id)) {
    return node;
  }

  const newPath = [...relationshipPath, data.id];

  // Get filter options for this node
  const nodeFilterKey = `${data.id}-${direction === 'right' ? 'children' : 'parents'}`;
  const nodeFilterOptions = filterOptions.get(nodeFilterKey) || DEFAULT_FILTER_OPTIONS;

  // Determine expansion state
  const isExplicitlyExpanded =
    (direction === "right" && expandedNodes.has(`${data.id}-children`)) ||
    (direction === "left" && expandedNodes.has(`${data.id}-parents`));

  const isExplicitlyCollapsed =
    (direction === "right" && expandedNodes.has(`${data.id}-children-collapsed`)) ||
    (direction === "left" && expandedNodes.has(`${data.id}-parents-collapsed`));

  // Process relationships with importance filtering
  if (direction === "right" && data.children && data.children.length > 0) {
    let childrenToShow = data.children;
    
    // Apply importance filtering if there are many children
    if (data.children.length > 10) {
      childrenToShow = filterRelationshipsByImportance(
        data.children,
        linkStats,
        data.id,
        'children',
        nodeFilterOptions
      );
    }

    const processedChildren = childrenToShow.map((child, index) =>
      processTreeWithImportanceFiltering(
        child,
        "right",
        expandedNodes,
        linkStats,
        filterOptions,
        node,
        depth + 1,
        [...newPath, `child-${index}`]
      )
    );

    const shouldShowChildren = isExplicitlyExpanded || 
      (!isExplicitlyCollapsed && data.children.length <= 1);

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
    let parentsToShow = data.parents;
    
    // Apply importance filtering if there are many parents
    if (data.parents.length > 10) {
      const filteredDirection = nodeFilterOptions.relationshipType === 'all' || 
                               nodeFilterOptions.relationshipType === 'parents' ? 'parents' : 'parents';
      parentsToShow = filterRelationshipsByImportance(
        data.parents,
        linkStats,
        data.id,
        'parents',
        nodeFilterOptions
      );
    }

    const processedParents = parentsToShow.map((parent, index) =>
      processTreeWithImportanceFiltering(
        parent,
        "left",
        expandedNodes,
        linkStats,
        filterOptions,
        node,
        depth + 1,
        [...newPath, `parent-${index}`]
      )
    );

    const shouldShowParents = isExplicitlyExpanded || 
      (!isExplicitlyCollapsed && data.parents.length <= 1);

    if (shouldShowParents) {
      node.children = processedParents;
      node._children = [];
    } else {
      node.children = [];
      node._children = processedParents;
    }
  }

  return node;
}

/**
 * Get summary of filtered vs total relationships
 */
export function getRelationshipSummary(
  relationships: RelationshipTree[] | undefined,
  linkStats: Map<string, LinkStats>,
  parentId: string,
  direction: 'children' | 'parents',
  filterOptions: FilterOptions
): { total: number; showing: number; filtered: number; hasMore: boolean } {
  if (!relationships) return { total: 0, showing: 0, filtered: 0, hasMore: false };
  
  const total = relationships.length;
  if (total <= 10) {
    return { total, showing: total, filtered: 0, hasMore: false };
  }
  
  const filtered = filterRelationshipsByImportance(
    relationships,
    linkStats,
    parentId,
    direction,
    filterOptions
  );
  
  const showing = Math.min(filtered.length, filterOptions.showCount);
  const hasMore = total > showing;
  
  return { total, showing, filtered: filtered.length, hasMore };
}
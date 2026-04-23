import type { TreeNode } from "$lib/types";

export interface LinkStats {
    eventCount: number,
    lastWrite?: number,
    lastRead?: number,
    linkType: 'read' | 'write';
}

export interface TreeLayoutResult {
    treeData: d3.HierarchyPointNode<TreeNode>,
    dynamicHeight: number
}

export interface RelationshipScore {
  id: string;
  score: number;
  lastActivity: number;
  eventCount: number;
  isRecent: boolean;
  isPriority: boolean;
}

export interface FilterOptions {
  searchTerm: string;
  relationshipType: 'all' | 'children' | 'parents';
  sortBy: 'importance' | 'recent' | 'alphabetical' | 'activity';
  showCount: number;
  includeInactive: boolean;
}

export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  searchTerm: '',
  relationshipType: 'all',
  sortBy: 'importance',
  showCount: 7, // Show top 7 by default, leave room for controls
  includeInactive: true
};

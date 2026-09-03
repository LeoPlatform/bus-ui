import type { TreeNode } from "$lib/types";

export interface LinkStats {
    eventCount: number,
    /** Write links: when the bot last wrote to this queue. */
    lastWrite?: number,
    /** Read links: when the bot last read from this queue. */
    lastRead?: number,
    /** When the newest event this link carried was originally created (drives read lag). */
    sourceTimestamp?: number,
    /** This link's checkpoint token, compared against the queue's newest to detect catch-up. */
    checkpoint?: string,
    /** Read links: the bot's checkpoint has reached the queue's newest write, so lag is zero. */
    caughtUp?: boolean,
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

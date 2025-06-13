import type { TreeNode } from "$lib/types";

export interface LinkStats {
    eventCount: number,
    lastWrite: number,
    linkType: 'read' | 'write';
}

export interface TreeLayoutResult {
    treeData: d3.HierarchyPointNode<TreeNode>,
    dynamicHeight: number
}
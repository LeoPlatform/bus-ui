import type { BotSettings, RelationshipTree } from '$lib/types';
import { error } from '@sveltejs/kit';

export async function load({parent}) {
    const {botData, id} = await parent();
    console.log('attempting to load the bot data for bot ', id);

    if (!botData || botData.length == 0) {
        error(500, 'Failed to load bot settings')
    } else if (!id) {
        error(500, 'bot id missing')
    } else {
        console.log('generating the relationship tree');
        const relationShipTree = buildRelationShipTree(botData, id);
        console.log('relationship tree generated');
        console.log(relationShipTree);
        return {
            relationShipTree,
        };
    }
}

// export const load = (async () => {
//     let botSettings: BotSettings[] = await parent();
//     // botDetailStore.subscribe((value) => {
//     //     botSettings = value;
//     // });

//     if (!botSettings || botSettings.length == 0) {
//         error(500, 'Failed to load bot settings')
//     } else {
//         return {
//             relationShipTree: buildRelationShipTree(botSettings)
//         }
//     }
// }) satisfies PageLoad;

//TODO: in the future we only want to build a tree for the selected node for right now we can balloon this out
// function buildRelationShipTree(botSettings: BotSettings[], nodeId: string): Record<string, RelationshipTree> {

//     const tree: Record<string, RelationshipTree> = {};

//     botSettings.forEach((bot) => {

//         if(!tree[bot.id]) {
//             tree[bot.id] = {
//                 id: bot.id,
//                 children: [],
//                 parents: []
//             };
//         }

//         if (bot.checkpoints?.read) {
//             Object.keys(bot.checkpoints.read).forEach((queueId) => {
//                 if (!tree[queueId]) {
//                     tree[queueId] = {
//                         id: queueId,
//                         children: [],
//                         parents: [],
//                     };
//                 }
//             });
//         }

//         if (bot.checkpoints?.write) {
//             Object.keys(bot.checkpoints.write).forEach((queueId) => {
//                 if (!tree[queueId]) {
//                     tree[queueId] = {
//                         id: queueId,
//                         children: [],
//                         parents: [],
//                     };
//                 }
//             });
//         }
//     });

//     // Establish the relationship
//     botSettings.forEach((bot) => {
//         if(bot.checkpoints?.read) {
//             Object.keys(bot.checkpoints.read).forEach((queueId) => {
//                 if(!tree[bot.id].parents.some(parent=>parent.id === queueId)) {
//                     tree[bot.id].parents.push({
//                         id: queueId,
//                         children: [],
//                         parents: []
//                     });
//                 }

//                 if(!tree[queueId].children.some(child=>child.id === bot.id)) {
//                     tree[queueId].children.push({
//                         id: bot.id,
//                         children: [],
//                         parents: []
//                     });
//                 }
//             });
//         }

//         if (bot.checkpoints?.write) {
//             Object.keys(bot.checkpoints.write).forEach((queueId) => {
//                 if(!tree[bot.id].children.some(child => child.id === queueId)) {
//                     tree[bot.id].children.push({
//                         id: queueId,
//                         children: [],
//                         parents: []
//                     });
//                 }

//                 if(!tree[queueId].parents.some(parent => parent.id === bot.id)) {
//                     tree[queueId].parents.push({
//                         id: bot.id,
//                         children: [],
//                         parents: []
//                     });
//                 }
//             });
//         }
//     });

//     // Now build the full tree recursively
//     const fullTree: Record<string, RelationshipTree> = {};
    
//     // Helper function to build a complete subtree
//     function buildFullSubtree(nodeId: string, visited: Set<string> = new Set()): RelationshipTree {
//         // Prevent infinite recursion due to cycles
//         if (visited.has(nodeId)) {
//             return {
//                 id: nodeId,
//                 children: [],
//                 parents: []
//             };
//         }
        
//         visited.add(nodeId);
//         const node = tree[nodeId];
        
//         const fullNode: RelationshipTree = {
//             id: node.id,
//             children: [],
//             parents: []
//         };
        
//         // Recursively build children
//         node.children.forEach(child => {
//             fullNode.children.push(buildFullSubtree(child.id, new Set(visited)));
//         });
        
//         // Recursively build parents
//         node.parents.forEach(parent => {
//             fullNode.parents.push(buildFullSubtree(parent.id, new Set(visited)));
//         });
        
//         return fullNode;
//     }
    
//     // Build full tree for each node
//     Object.keys(tree).forEach(nodeId => {
//         fullTree[nodeId] = buildFullSubtree(nodeId);
//     });
    
//     return fullTree;
// }

function buildRelationShipTree(botSettings: BotSettings[], startingNodeId: string): RelationshipTree {
    // First, create a flat map of all nodes and their direct relationships
    const flatTree: Record<string, {
        id: string,
        children: string[],
        parents: string[]
    }> = {};

    // Initialize all nodes
    botSettings.forEach((bot) => {
        if(!flatTree[bot.id]) {
            flatTree[bot.id] = {
                id: bot.id,
                children: [],
                parents: []
            };
        } 

        // Add queue nodes from read checkpoints
        if (bot.checkpoints?.read) {
            Object.keys(bot.checkpoints.read).forEach((queueId) => {
                if (!flatTree[queueId]) {
                    flatTree[queueId] = {
                        id: queueId,
                        children: [],
                        parents: [],
                    };
                }
            });
        }

        // Add queue nodes from write checkpoints
        if (bot.checkpoints?.write) {
            Object.keys(bot.checkpoints.write).forEach((queueId) => {
                if (!flatTree[queueId]) {
                    flatTree[queueId] = {
                        id: queueId,
                        children: [],
                        parents: [],
                    };
                }
            });
        }
    });

    // Establish the direct relationships in the flat tree
    botSettings.forEach((bot) => {
        // Bot reads from queue -> queue is parent of bot
        if(bot.checkpoints?.read) {
            Object.keys(bot.checkpoints.read).forEach((queueId) => {
                if(!flatTree[bot.id].parents.includes(queueId)) {
                    flatTree[bot.id].parents.push(queueId);
                }
                if(!flatTree[queueId].children.includes(bot.id)) {
                    flatTree[queueId].children.push(bot.id);
                }
            });
        }

        // Bot writes to queue -> queue is child of bot
        if (bot.checkpoints?.write) {
            Object.keys(bot.checkpoints.write).forEach((queueId) => {
                if(!flatTree[bot.id].children.includes(queueId)) {
                    flatTree[bot.id].children.push(queueId);
                }
                if(!flatTree[queueId].parents.includes(bot.id)) {
                    flatTree[queueId].parents.push(bot.id);
                }
            });
        }
    });

    function buildHierarchicalTree(nodeId: string, direction: "both" | "ancestors" | "descendants", visited: Set<string> = new Set()): RelationshipTree {
        // Prevent infinite recursion due to cycles
        if (visited.has(nodeId)) {
            return {
                id: nodeId,
                children: [],
                parents: []
            };
        }
        
        // Mark this node as visited
        visited.add(nodeId);
        
        // Get the node from the flat tree
        const node = flatTree[nodeId];
        if (!node) {
            return {
                id: nodeId,
                children: [],
                parents: []
            };
        }
        
        // Create the hierarchical node
        const hierarchicalNode: RelationshipTree = {
            id: node.id,
            children: [],
            parents: []
        };
        
        // Recursively build children
        if(direction == "both" || direction == "descendants") {
            node.children.forEach(childId => {
                // Create a new visited set for each branch to allow nodes to appear in multiple places
                const newVisited = new Set(visited);
                hierarchicalNode.children.push(buildHierarchicalTree(childId,  "descendants", newVisited));
            });

        }

        if (direction == "both" || direction == "ancestors") {
            // Recursively build parents
            node.parents.forEach(parentId => {
                // Create a new visited set for each branch to allow nodes to appear in multiple places
                const newVisited = new Set(visited);
                hierarchicalNode.parents.push(buildHierarchicalTree(parentId,  "ancestors", newVisited));
            });
        }
        
        return hierarchicalNode;
    }

    return buildHierarchicalTree(startingNodeId, "both");
}


import type { BotSettings, CheckpointType, RelationshipTree } from '$lib/types';
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


function buildRelationShipTree(botSettings: BotSettings[], startingNodeId: string): RelationshipTree {
    // First, create a flat map of all nodes and their direct relationships
    const flatTree: Record<string, {
        id: string,
        name?: string,
        paused?: boolean,
        rogue?: boolean,
        alarmed?: boolean,
        children: string[],
        parents: string[]
    }> = {};

    // Initialize all nodes
    botSettings.forEach((bot) => {
        if(!flatTree[bot.id] && !bot.archived) {
            flatTree[bot.id] = {
                id: bot.id,
                name: bot.name,
                paused: bot.paused,
                children: [],
                parents: []
            };
        } 

        if (bot.checkpoints) {
            ["read", "write"].forEach( type => {
                if (!bot.checkpoints[type as CheckpointType]) {
                    return
                };
                Object.keys(bot.checkpoints[type as CheckpointType]).forEach((queueId) => {
                    if (!flatTree[queueId] || (queueId.match(/\/_archive$/g) || queueId.match(/\/_snapshot$/g))) {
                    flatTree[queueId] = {
                        id: queueId,
                        children: [],
                        parents: [],
                    };
                    }
                });
            })
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
            name: node.name,
            paused: node.paused,
            alarmed: node.alarmed,
            rogue: node.rogue,
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


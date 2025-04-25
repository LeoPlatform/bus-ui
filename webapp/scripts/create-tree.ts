import { BotSettings, RelationshipTree } from '../src/lib/types'
import { writeFileSync, readFileSync } from 'fs';


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

    function buildHierarchicalTree(nodeId: string, visited: Set<string> = new Set()): RelationshipTree {
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
        node.children.forEach(childId => {
            // Create a new visited set for each branch to allow nodes to appear in multiple places
            const newVisited = new Set(visited);
            hierarchicalNode.children.push(buildHierarchicalTree(childId, newVisited));
        });
        
        // Recursively build parents
        node.parents.forEach(parentId => {
            // Create a new visited set for each branch to allow nodes to appear in multiple places
            const newVisited = new Set(visited);
            hierarchicalNode.parents.push(buildHierarchicalTree(parentId, newVisited));
        });
        
        return hierarchicalNode;
    }

    return buildHierarchicalTree(startingNodeId);
}






// function buildRelationShipTree(botSettings: BotSettings[]): Record<string, RelationshipTree> {
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

//     return tree;
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
//     // const tree: Record<string, RelationshipTree> = {};
//     // botSettings.forEach((bot) => {
//     //     // const relationship: RelationshipTree = {
//     //     //     id: bot.id,
//     //     //     children: [],
//     //     //     parents: []
//     //     // };
//     //    const existingRecord = tree[bot.id];
//     //    if (existingRecord) {

//     //    }

//     // //  tree[bot.id] = buildTreeForId(botSettings, bot.id);
//     // })
//     // return tree;
 
//  //    botSettings.forEach((bot) => {
//  //     const id = bot.id;
//  //     const botChildren = [];
//  //     const botParent = [];
//  //     if(bot.checkpoints && bot.checkpoints.read) {
//  //        Object.keys(bot.checkpoints.read).forEach((key) => {
//  //         tree[key] = {
//  //             id: key,
//  //             parents: []
//  //         }
//  //        })
//  //     }
//  //     if(bot.checkpoints && bot.checkpoints.write) {
//  //         Object.keys(bot.checkpoints.write).forEach((key) => {
//  //          tree[key] = {
//  //              id: key,
//  //              children: [ {
 
//  //              }]
//  //          }
//  //         })
//  //      }
//      //   tree[bot.id] = {
//      //      id: bot.id,
//      //   }
//     // })
 
//  }

// function buildTreeForId(botSettings: BotSettings[], id: string): RelationshipTree {
//     const tree: RelationshipTree = {
//         id: id,
//         children: [],
//         parents: []
//     };

//     botSettings.forEach((bot) => {
//         const readKeys = bot.checkpoints?.read ? Object.keys(bot.checkpoints.read) : [];
//         const writeKeys = bot.checkpoints?.write ? Object.keys(bot.checkpoints.write) : [];
//         if (bot.id == id) {
//             tree.parents = readKeys.map((key) => buildTreeForId(botSettings, key));
//             tree.children = writeKeys.map((key) => buildTreeForId(botSettings, key));
//         } else if (readKeys.includes(id)) {
//             tree.children = tree.children ? [...tree.children, buildTreeForId(botSettings, id)]: [buildTreeForId(botSettings, id)];
//         } else if (writeKeys.includes(id)) {
//             tree.parents = tree.parents ? [...tree.parents, buildTreeForId(botSettings, id)] : [buildTreeForId(botSettings, id)];
//         }
        
//     });
//     return tree;
// }

function sanitize(tree: Record<string, RelationshipTree>): Record<string, any> {
    const result: Record<string, any> = {};

    Object.keys(tree).forEach(id => {
        const node = tree[id];
        result[id] = {
            id: node.id,
            children: node.children.map(child => child.id),
            parents: node.parents.map(parent => parent.id)
        }
    });
    return result;
}

const botDataRaw = readFileSync('botDynamoData.json', 'utf8');
const botData: BotSettings[] = JSON.parse(botDataRaw);

const tree = buildRelationShipTree(botData, 'queue:item-entity-old-new');
// const sanitizedTree = sanitize(tree);
writeFileSync('botData.json', JSON.stringify(tree, null, 2));

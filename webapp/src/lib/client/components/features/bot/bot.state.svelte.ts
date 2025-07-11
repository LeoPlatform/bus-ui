import {
    type RelationshipTree,
  StatsRange,
  type BotSettings,
  type BotSettingsApiResponse,
  type MergedStatsRecord,
  type StatsApiResponse,
} from "$lib/types";
import type { TimePickerState } from "../time-picker/time-picker.state.svelte";

type GlobalFetch = typeof globalThis.fetch;

const STALE_TIME = 1000 * 30; // 30 seconds

export class BotState {
  #fetch: GlobalFetch;
  #botSettings = $state<BotSettings[]>([]);
  #relationShipTree = $state<RelationshipTree | null>(null);
  #stats = $state<MergedStatsRecord[]>([]);
  #visibleIds = $state<string[]>([]);
  #fetchedStats: Map<string, number>;
  #selectedBotId = $state<string | null>(null);
  #staleTime: number;
  #refreshOnTime = $derived.by(() => {
    if(!this.#timePickerState?.endTime) {
      //Real time mode
      return true;
    }

    const now = Date.now();
    const endTime = this.#timePickerState.endTime;

    if(endTime < now) {
      console.log('endTIme is in the past disabling automatic refresh');
      return false;
    }

    return true;
  });
  #timePickerState: TimePickerState | null = null;

  constructor(fetch: GlobalFetch, staleTime: number = 1000 * 30) {
    this.#fetch = fetch;
    this.#fetchedStats = new Map();
    this.#staleTime = staleTime;
  }

  setTimePickerState(timePickerState: TimePickerState) {
    this.#timePickerState = timePickerState;
  }

  get stats() {
    return this.#stats;
  }

  get botSettings() {
    return this.#botSettings;
  }
  get relationShipTree() {
    return this.#relationShipTree!;
  }

  get visibleIds() {
    return this.#visibleIds;
  }

  get staleTime() {
    return this.#staleTime;
  }

  get refreshOnTime() {
    return this.#refreshOnTime;
  }

  set selectedBotId(id: string) {
    this.#selectedBotId = id;
  }

  set visibleIds(ids: string[]) {
    this.#visibleIds = ids;
  }


  set relationShipTree(tree: RelationshipTree) {
    this.#relationShipTree = tree;
  }


  async fetchBotStats() {

    const now = Date.now();
    const staleIds = new Set<string>();

    this.visibleIds.forEach((id) => {
      if(!this.#fetchedStats.has(id) || now - this.#fetchedStats.get(id)! > this.#staleTime) {
        staleIds.add(id);
      }
    });

    // Filter the id's we are fetching to only include 'stale' nodes
    if (staleIds.size > 0) {
      const res = await this.#fetch("/api/workflow/stats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.#timePickerState?.createStatsQueryRequest(Array.from(staleIds)))
      });

      const data = (await res.json()) as StatsApiResponse;

      staleIds.forEach((id) => {
        this.#fetchedStats.set(id, now);
      });

      // Merge the data in
      this.mergeStatsIntoState(data.stats);
    }
  }

  async fetchBotSettings() {
    const res = await this.#fetch("/api/workflow/relationships");
    const data = (await res.json()) as BotSettingsApiResponse;
    this.mergeBotSettingsIntoState(data.botData);
  }

  mergeBotSettingsIntoState(botSettings: BotSettings[]) {
    for (const bot of botSettings) {
      const existingIdx = this.#botSettings.findIndex((b) => b.id === bot.id);
      if (existingIdx !== -1) {
        this.#botSettings[existingIdx] = bot;
      } else {
        this.#botSettings.push(bot);
      }
    }
  }

  mergeStatsIntoState(stats: MergedStatsRecord[]) {
    for (const stat of stats) {
        const existingId = this.#stats.findIndex((s) => s.id === stat.id);
        if (existingId !== -1) {
          this.#stats[existingId] = stat;
        } else {
          this.#stats.push(stat);
        }
    }
  }
  
  buildRelationShipTree() {
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
      this.#botSettings.forEach((bot) => {
          if(!bot.archived && !flatTree[bot.id]) {
              flatTree[bot.id] = {
                  id: bot.id,
                  name: bot.name,
                  paused: bot.paused,
                  rogue: bot.errorCount ? bot.errorCount > 10 : false,
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
                      if (!flatTree[queueId] && !(queueId.match(/\/_archive$/g) || queueId.match(/\/_snapshot$/g))) {
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
      this.#botSettings.forEach((bot) => {
          if (bot.archived) return;
          // Bot reads from queue -> queue is parent of bot
          if(bot.checkpoints?.read) {
              Object.keys(bot.checkpoints.read).forEach((queueId) => {
                 if(flatTree[queueId]) {
                     if(!flatTree[bot.id].parents.includes(queueId)) {
                         flatTree[bot.id].parents.push(queueId);
                     }
                     if(!flatTree[queueId].children.includes(bot.id)) {
                         flatTree[queueId].children.push(bot.id);
                     }

                 }
              });
          }
  
          // Bot writes to queue -> queue is child of bot
          if (bot.checkpoints?.write) {
              Object.keys(bot.checkpoints.write).forEach((queueId) => {
                if(flatTree[queueId]) {
                    if(!flatTree[bot.id].children.includes(queueId)) {
                        flatTree[bot.id].children.push(queueId);
                    }
                    if(!flatTree[queueId].parents.includes(bot.id)) {
                        flatTree[queueId].parents.push(bot.id);
                    }
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
  
      this.#relationShipTree = buildHierarchicalTree(this.#selectedBotId!, "both");
  }

  clearStatsCache() {
    this.#fetchedStats = new Map();
  }
  
}

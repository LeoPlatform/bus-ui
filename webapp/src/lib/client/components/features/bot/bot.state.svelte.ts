import {
  type CatalogRow,
  type RelationshipTree,
  StatsRange,
  type BotSettings,
  type BotSettingsApiResponse,
  type MergedStatsRecord,
  type QueueSettings,
  type StatsApiResponse,
  type DashboardStats,
  type DashboardStatsApiResponse,
  type CheckpointType,
  type SystemSettings,
} from "$lib/types";
import type { TimePickerState } from "../time-picker/time-picker.state.svelte";
import type { BotStatus } from "./bot-status.constants";
import { evaluateBotStatus } from "./bot-status.utils";

type GlobalFetch = typeof globalThis.fetch;

const STALE_TIME = 1000 * 30; // 30 seconds

function catalogRowFromQueue(q: QueueSettings): CatalogRow | null {
  const event = q.event;
  if (!event || /\/_archive$|\/_snapshot$/.test(event)) return null;
  const id = /^queue:/.test(event) ? event : `queue:${event}`;
  const tagVal = q.other?.tags;
  const tags =
    tagVal == null || tagVal === "" ? undefined : String(tagVal);
  return {
    kind: "queue",
    id,
    name: q.name || event.replace(/^queue:/, ""),
    tags,
    archived: q.archived,
    health: {},
    errorCount: 0,
    lambdaName: undefined,
  };
}

function catalogRowFromSystem(s: SystemSettings): CatalogRow {
  const raw = s.id.replace(/^system:/, "");
  const id = /^system:/.test(s.id) ? s.id : `system:${s.id}`;
  return {
    kind: "system",
    id,
    name: s.label || raw,
    tags: undefined,
    archived: s.archived,
    health: {},
    errorCount: 0,
    lambdaName: undefined,
  };
}

export class BotState {
  #fetch: GlobalFetch;
  #botSettings = $state<BotSettings[]>([]);
  #queueRows = $state<QueueSettings[]>([]);
  #systemRows = $state<SystemSettings[]>([]);
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
      // console.log('endTIme is in the past disabling automatic refresh');
      return false;
    }

    return true;
  });
  #timePickerState: TimePickerState | null = null;

  /** Home table: bots + queues + systems (does not drive relationship tree). */
  catalogRows = $derived.by((): CatalogRow[] => {
    const rows: CatalogRow[] = [];
    for (const b of this.#botSettings) {
      rows.push({
        kind: "bot",
        id: b.id,
        name: b.name ?? b.lambdaName,
        tags: b.tags,
        archived: b.archived,
        health: b.health,
        errorCount: b.errorCount,
        lambdaName: b.lambdaName,
      });
    }
    for (const q of this.#queueRows) {
      const r = catalogRowFromQueue(q);
      if (r) rows.push(r);
    }
    for (const s of this.#systemRows) {
      rows.push(catalogRowFromSystem(s));
    }
    return rows;
  });

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

  /** Non-archived bots with active SLA / lag / error alarms (after stats merge). */
  get alarmedBotCount(): number {
    return this.#botSettings.filter((b) => !b.archived && Boolean(b.isAlarmed)).length;
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
    if (this.#selectedBotId === id) return;
    this.#selectedBotId = id;
    this.buildRelationShipTree();
  }

  set visibleIds(ids: string[]) {
    this.#visibleIds = ids;
  }


  set relationShipTree(tree: RelationshipTree) {
    this.#relationShipTree = tree;
  }

  getCurrentRange() {
    // if(this.#timePickerState?.range) {
      return this.#timePickerState?.range;
    // }
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

  async fetchDashboardStats(id: string): Promise<DashboardStats> {
    const res = await this.#fetch("/api/dashboard/details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        range: this.#timePickerState?.range || StatsRange.Minute15,
        timestamp: this.#timePickerState?.endTime || Date.now(),
        // sourceId: sourceId
      })
    });

    if (!res.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    const data = (await res.json()) as DashboardStatsApiResponse;
    return data.dashStats;
  }

  async fetchBotSettings() {
    try {
      const res = await this.#fetch("/api/workflow/relationships");
      if (!res.ok) {
        console.error('Failed to fetch bot settings:', res.status, res.statusText);
        return;
      }
      
      const data = (await res.json()) as BotSettingsApiResponse;

      if (!data || !data.botData || !Array.isArray(data.botData)) {
        console.warn("Invalid bot settings response:", data);
        return;
      }

      this.#queueRows = Array.isArray(data.queueData) ? data.queueData : [];
      this.#systemRows = Array.isArray(data.systemData) ? data.systemData : [];
      this.mergeBotSettingsIntoState(data.botData);
    } catch (error) {
      console.error('Error fetching bot settings:', error);
    }
  }

  mergeBotSettingsIntoState(botSettings: BotSettings[]) {
    // Safety check: ensure botSettings is an array
    if (!Array.isArray(botSettings)) {
      console.warn('botSettings is not an array:', botSettings);
      return;
    }
    
    for (const bot of botSettings) {
      const existingIdx = this.#botSettings.findIndex((b) => b.id === bot.id);
      if (existingIdx !== -1) {
        this.#botSettings[existingIdx] = bot;
      } else {
        this.#botSettings.push(bot);
      }
    }
    
    // Calculate bot statuses after merging settings
    this.evaluateBotStatuses();
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
    
    // Calculate bot statuses after merging stats
    this.evaluateBotStatuses();
  }
  
  buildRelationShipTree() {
      // First, create a flat map of all nodes and their direct relationships
      const flatTree: Record<string, {
          id: string,
          name?: string,
          paused?: boolean,
          rogue?: boolean,
          alarmed?: boolean,
          status?: string,
          isAlarmed?: boolean,
          alarms?: any,
          archived?: boolean,
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
                  rogue: bot.rogue,
                  alarmed: bot.alarmed,
                  status: bot.status,
                  isAlarmed: bot.isAlarmed,
                  alarms: bot.alarms,
                  archived: bot.archived,
                  children: [],
                  parents: []
              };
          } 
  
          if (bot.checkpoints) {
              ["read", "write"].forEach( type => {
                  const checkpointType = type as CheckpointType;
                  if (!bot.checkpoints![checkpointType]) {
                      return
                  };
                  Object.keys(bot.checkpoints![checkpointType]).forEach((queueId) => {
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
              archived: node.archived,
              status: node.status as BotStatus,
              isAlarmed: node.isAlarmed,
              alarms: node.alarms,
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

  private evaluateBotStatuses() {
    this.#botSettings.forEach(bot => {
      // Find the stats for this bot
      const botStats = this.#stats.find(s => s.id === bot.id);
      
      // Calculate the bot's status based on its stats
      const statusEvaluation = evaluateBotStatus(bot, botStats, bot.health);
      
      // Update the bot object with calculated values
      bot.status = statusEvaluation.status;
      bot.isAlarmed = statusEvaluation.isAlarmed;
      bot.alarms = statusEvaluation.alarms;
      bot.rogue = statusEvaluation.rogue;
      bot.alarmed = statusEvaluation.isAlarmed; // Keep for compatibility
    });

    // Trigger reactivity by reassigning the array
    this.#botSettings = [...this.#botSettings];
  }
  
}

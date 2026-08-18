import { BOT_STATUS_DEFAULTS, type BotStatus, type BotHealthConfig, type BotAlarms, type BotStatusEvaluation } from './bot-status.constants';
import { humanize } from '$lib/utils';
import type { MergedStatsRecord, BotSettings } from '$lib/types';

export function evaluateBotStatus(
  bot: BotSettings,
  stats: MergedStatsRecord | undefined,
  healthConfig?: BotHealthConfig
): BotStatusEvaluation {
  const config = {
    error_limit: healthConfig?.error_limit ?? BOT_STATUS_DEFAULTS.ERROR_RATE_THRESHOLD,
    write_lag: healthConfig?.write_lag ?? BOT_STATUS_DEFAULTS.WRITE_LAG_THRESHOLD,
    source_lag: healthConfig?.source_lag ?? BOT_STATUS_DEFAULTS.SOURCE_LAG_THRESHOLD,
    consecutive_errors: healthConfig?.consecutive_errors ?? BOT_STATUS_DEFAULTS.CONSECUTIVE_ERRORS_THRESHOLD,
  };

  let status: BotStatus = 'running';
  let isAlarmed = false;
  let alarms: BotAlarms = {};

  // 1. Check if bot is ROGUE.
  //    Match the legacy bus-ui behavior (old_ui/lib/stats.js): rogue is driven by the
  //    persisted consecutive-error counter on the cron record (reset to 0 on force-run /
  //    success), NOT by errors summed over the currently-viewed stats window. This keeps
  //    rogue a sticky "needs intervention until cleared" state that doesn't disappear when
  //    the operator narrows the time range — or when the bot has no stats in the window.
  //    Evaluate it BEFORE the no-stats short-circuit so a quiet rogue bot still shows rogue.
  const persistedErrorCount = bot.errorCount ?? 0;
  const rogue = persistedErrorCount > BOT_STATUS_DEFAULTS.ROGUE_ERROR_THRESHOLD;
  if (rogue) {
    status = 'rogue';
  }

  // If no stats available, we can't compute lag/error-rate alarms, but the record alone
  // still tells us rogue / paused / archived — apply those and return.
  if (!stats) {
    return {
      status: applyManualStates(bot, status, rogue, isAlarmed),
      isAlarmed, alarms, rogue, errorCount: 0, errorRate: 0, writeLag: 0, sourceLag: 0,
    };
  }

  // Calculate error statistics from raw stats
  const errorCount = calculateErrorCount(stats);
  const executions = calculateExecutions(stats);
  const errorRate = executions > 0 ? errorCount / executions : 0;

  // Calculate lag values from raw stats
  const writeLag = calculateWriteLag(stats);
  const sourceLag = calculateSourceLag(stats);

  // 2. Check if bot is BLOCKED (has current errors).
  //    Rogue is the more severe error state, so only fall back to BLOCKED when the bot
  //    isn't rogue — otherwise the rogue status set above would be clobbered here.
  if (!rogue && hasCurrentErrors(stats)) {
    status = 'blocked';
  }

  // 3. Check ALARM conditions
  
  // Error Rate Alarm
  if (errorCount >= 1 && errorRate >= config.error_limit && !bot.archived) {
    isAlarmed = true;
    alarms.errors = {
      value: errorCount,
      limit: `${errorCount} > ${Math.floor(executions * config.error_limit)}`,
      msg: `Error rate: ${(errorRate * 100).toFixed(1)}% (${errorCount}/${executions})`
    };
  }
  
  // Write Lag Alarm
  if (writeLag >= config.write_lag && !bot.archived) {
    isAlarmed = true;
    alarms.write_lag = {
      value: humanize(writeLag),
      limit: humanize(config.write_lag),
      msg: `Write lag: ${humanize(writeLag)} > ${humanize(config.write_lag)}`
    };
  }
  
  // Source Lag Alarm
  if (sourceLag >= config.source_lag && !bot.archived) {
    isAlarmed = true;
    alarms.source_lag = {
      value: humanize(sourceLag),
      limit: humanize(config.source_lag),
      msg: `Source lag: ${humanize(sourceLag)} > ${humanize(config.source_lag)}`
    };
  }

  // 4. Override with manual states (archived / paused / danger).
  status = applyManualStates(bot, status, rogue, isAlarmed);

  return {
    status,
    isAlarmed,
    alarms,
    rogue,
    errorCount,
    errorRate,
    writeLag,
    sourceLag,
  };
}

/**
 * Apply the manual/terminal status overrides (archived / paused / danger) on top of the
 * error-derived status. Shared by the no-stats path and the full evaluation so the two
 * can't drift.
 *
 * Precedence matches legacy bus-ui (old_ui/stores/dataStore.js): archived wins outright;
 * a rogue bot stays rogue even when paused (so a paused bot that went bad is still visible);
 * a non-rogue paused bot shows paused; and an alarmed running/paused bot escalates to danger.
 */
function applyManualStates(
  bot: BotSettings,
  status: BotStatus,
  rogue: boolean,
  isAlarmed: boolean,
): BotStatus {
  if (bot.archived) return 'archived';
  if (bot.paused && !rogue) return 'paused';
  if (isAlarmed && (status === 'running' || status === 'paused')) return 'danger';
  return status;
}

// Helper functions to extract values from raw stats
function calculateErrorCount(stats: MergedStatsRecord): number {
  let errorCount = 0;
  
  if (stats.read) {
    Object.values(stats.read).forEach(readStat => {
      errorCount += readStat.errors || 0;
    });
  }
  
  if (stats.write) {
    Object.values(stats.write).forEach(writeStat => {
      errorCount += writeStat.errors || 0;
    });
  }
  
  return errorCount;
}

function calculateExecutions(stats: MergedStatsRecord): number {
  let executions = 0;
  
  if (stats.read) {
    Object.values(stats.read).forEach(readStat => {
      executions += readStat.units || 0;
    });
  }
  
  if (stats.write) {
    Object.values(stats.write).forEach(writeStat => {
      executions += writeStat.units || 0;
    });
  }
  
  return executions;
}

function calculateWriteLag(stats: MergedStatsRecord): number {
  const now = Date.now();
  let maxWriteLag = 0;
  
  if (stats.write) {
    Object.values(stats.write).forEach(writeStat => {
      const lastWrite = new Date(writeStat.timestamp).getTime();
      const lag = now - lastWrite;
      maxWriteLag = Math.max(maxWriteLag, lag);
    });
  }
  
  return maxWriteLag;
}

function calculateSourceLag(stats: MergedStatsRecord): number {
  const now = Date.now();
  let maxSourceLag = 0;

  if (stats.read) {
    Object.values(stats.read).forEach(readStat => {
      // Source lag uses source_timestamp (when the event was originally created),
      // not timestamp (when the bot last processed). This measures how far behind
      // the bot is from the actual event source time.
      const sourceTime = readStat.source_timestamp || readStat.timestamp;
      const lag = now - new Date(sourceTime).getTime();
      maxSourceLag = Math.max(maxSourceLag, lag);
    });
  }

  return maxSourceLag;
}

function hasCurrentErrors(stats: MergedStatsRecord): boolean {
  // Check if there are any errors in the current stats
  const errorCount = calculateErrorCount(stats);
  return errorCount > 0;
}
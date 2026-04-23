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
  let rogue = false;

  // If no stats available, return default values
  if (!stats) {
    return { status, isAlarmed, alarms, rogue, errorCount: 0, errorRate: 0, writeLag: 0, sourceLag: 0 };
  }

  // Calculate error statistics from raw stats
  const errorCount = calculateErrorCount(stats);
  const executions = calculateExecutions(stats);
  const errorRate = executions > 0 ? errorCount / executions : 0;

  // Calculate lag values from raw stats
  const writeLag = calculateWriteLag(stats);
  const sourceLag = calculateSourceLag(stats);

  // 1. Check if bot is ROGUE (>10 errors)
  if (errorCount > BOT_STATUS_DEFAULTS.ROGUE_ERROR_THRESHOLD) {
    rogue = true;
    status = 'rogue';
  }

  // 2. Check if bot is BLOCKED (has current errors)
  if (hasCurrentErrors(stats)) {
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

  // 4. Override with manual states
  if (bot.archived) {
    status = 'archived';
  } else if (bot.paused) {
    status = 'paused';
  } else if (isAlarmed && (status === 'running' || status === 'paused')) {
    status = 'danger';
  }

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
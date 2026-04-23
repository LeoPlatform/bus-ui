export const BOT_STATUS_DEFAULTS = {
  WRITE_LAG_THRESHOLD: 1000 * 60 * 1438560, // ~24 days in milliseconds
  SOURCE_LAG_THRESHOLD: 1000 * 60 * 2.5,    // 2.5 minutes in milliseconds
  ERROR_RATE_THRESHOLD: 0.5,                // 50% error rate
  CONSECUTIVE_ERRORS_THRESHOLD: 2,          // Number of consecutive errors
  ROGUE_ERROR_THRESHOLD: 10,                // Errors that make bot rogue
};

export type BotStatus = 'running' | 'paused' | 'archived' | 'blocked' | 'rogue' | 'danger';

export interface BotHealthConfig {
  error_limit?: number;
  write_lag?: number;
  source_lag?: number;
  consecutive_errors?: number;
}

export interface BotAlarm {
  value: number | string;
  limit: string;
  msg: string;
}

export interface BotAlarms {
  errors?: BotAlarm;
  write_lag?: BotAlarm;
  source_lag?: BotAlarm;
}

export interface BotStatusEvaluation {
  status: BotStatus;
  isAlarmed: boolean;
  alarms: BotAlarms;
  rogue: boolean;
  errorCount: number;
  errorRate: number;
  writeLag: number;
  sourceLag: number;
}
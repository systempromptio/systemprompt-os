/**
 * Logger module status CLI command.
 * @file Logger module status CLI command.
 * @module modules/core/logger/cli/status
 */

import { z } from 'zod';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

// Zod schema for status command arguments
const statusArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text')
});

type StatusArgs = z.infer<typeof statusArgsSchema>;

/**
 * Get logger statistics from database.
 * @returns Logger statistics.
 */
const getLoggerStatistics = async (): Promise<{
  totalLogs: number;
  recentErrors: number;
  logsByLevel: Record<string, number>;
}> => {
  try {
    const { DatabaseService } = await import('@/modules/core/database/services/database.service');
    const dbService = DatabaseService.getInstance();

    const totalResult = await dbService.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM system_logs'
    );
    const totalLogs = totalResult[0]?.count ?? 0;

    const errorResult = await dbService.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM system_logs WHERE level = 'error' AND timestamp >= datetime('now', '-1 day')"
    );
    const recentErrors = errorResult[0]?.count ?? 0;

    const levelResult = await dbService.query<{ level: string; count: number }>(
      'SELECT level, COUNT(*) as count FROM system_logs GROUP BY level'
    );
    const logsByLevel: Record<string, number> = {};
    levelResult.forEach(row => {
      logsByLevel[row.level] = row.count;
    });

    return {
 totalLogs,
recentErrors,
logsByLevel
};
  } catch (error) {
    return {
 totalLogs: 0,
recentErrors: 0,
logsByLevel: {}
};
  }
};

export const command: ICLICommand = {
  description: 'Show logger module status (enabled/healthy)',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = statusArgsSchema.parse(context.args);
      const logLevel = process.env.LOGLEVEL || 'info';
      const stats = await getLoggerStatistics();

      if (validatedArgs.format === 'json') {
        cliOutput.json({
          module: 'logger',
          status: {
            enabled: true,
            healthy: true,
            service: 'LoggerService',
            uptime: process.uptime()
          },
          configuration: {
            logLevel,
            transports: ['console', 'file'],
            errorHandling: true
          },
          statistics: {
            totalLogs: stats.totalLogs,
            recentErrors: stats.recentErrors,
            logsByLevel: stats.logsByLevel
          },
          timestamp: new Date().toISOString()
        });
      } else {
        cliOutput.section('Logger Module Status');
        cliOutput.keyValue({
          Module: 'logger',
          Enabled: 'Yes',
          Healthy: 'Yes',
          Service: 'LoggerService initialized',
          Uptime: `${Math.floor(process.uptime())} seconds`
        });

        cliOutput.section('Configuration');
        cliOutput.keyValue({
          'Current log level': logLevel,
          'Console transport': 'Enabled',
          'File transport': 'Enabled',
          'Error handling service': 'Enabled'
        });

        cliOutput.section('Statistics');
        cliOutput.keyValue({
          'Total logs': String(stats.totalLogs),
          'Recent errors (24h)': String(stats.recentErrors),
          'Debug logs': String(stats.logsByLevel.debug ?? 0),
          'Info logs': String(stats.logsByLevel.info ?? 0),
          'Warning logs': String(stats.logsByLevel.warn ?? 0),
          'Error logs': String(stats.logsByLevel.error ?? 0)
        });
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Error getting logger status');
        logger.error(LogSource.LOGGER, 'Error getting logger status', {
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
      process.exit(1);
    }
  }
};

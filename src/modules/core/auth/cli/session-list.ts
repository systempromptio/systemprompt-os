/**
 * Auth session list CLI command.
 * @file Lists sessions for a user.
 * @module modules/core/auth/cli/session-list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { type SessionListArgs, cliSchemas } from '@/modules/core/auth/utils/cli-validation';
import { z } from 'zod';

export const command: ICLICommand = {
  description: 'List sessions for a user',
  options: [
    {
      name: 'user-id',
      alias: 'u',
      type: 'string',
      description: 'User ID (UUID format)',
      required: true
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Maximum number of sessions to return',
      default: 20
    },
    {
      name: 'page',
      alias: 'p',
      type: 'number',
      description: 'Page number for pagination',
      default: 1
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs: SessionListArgs = cliSchemas.sessionList.parse(context.args);

      const authService = AuthService.getInstance();
      await authService.initialize();

      const sessionIds = await authService.listSessions(validatedArgs.userId);

      const sessionsData = {
        userId: validatedArgs.userId,
        sessions: sessionIds.map(id => { return {
          sessionId: id,
          status: 'active'
        } }),
        total: sessionIds.length,
        page: validatedArgs.page,
        limit: validatedArgs.limit
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(sessionsData);
      } else {
        cliOutput.section(`Sessions for User: ${validatedArgs.userId}`);

        if (sessionIds.length === 0) {
          cliOutput.info('No active sessions found');
        } else {
          const tableData = sessionIds.map(id => { return {
            'Session ID': id,
            'Status': 'Active'
          } });

          cliOutput.table(tableData, [
            {
 key: 'Session ID',
header: 'Session ID'
},
            {
 key: 'Status',
header: 'Status'
}
          ]);

          cliOutput.info(`Total: ${sessionIds.length} session(s)`);
        }
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Failed to list sessions');
        logger.error(LogSource.AUTH, "Session list command error", { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};

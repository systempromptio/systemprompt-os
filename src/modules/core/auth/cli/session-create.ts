/**
 * Auth session create CLI command.
 * @file Creates a new user session.
 * @module modules/core/auth/cli/session-create
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { type SessionCreateArgs, cliSchemas } from '@/modules/core/auth/utils/cli-validation';
import { z } from 'zod';

export const command: ICLICommand = {
  description: 'Create a new user session',
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
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      const validatedArgs: SessionCreateArgs = cliSchemas.sessionCreate.parse(context.args);

      const authService = AuthService.getInstance();
      await authService.initialize();

      const sessionId = await authService.createSession(validatedArgs.userId);

      const sessionData = {
        sessionId,
        userId: validatedArgs.userId,
        created: new Date().toISOString(),
        type: 'web',
        status: 'active'
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(sessionData);
      } else {
        cliOutput.success('Session created successfully');
        cliOutput.keyValue({
          'Session ID': sessionData.sessionId,
          'User ID': sessionData.userId,
          'Created': sessionData.created,
          'Type': sessionData.type,
          'Status': sessionData.status
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
        cliOutput.error('Failed to create session');
        logger.error(LogSource.AUTH, 'Session create command error', { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};

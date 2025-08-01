/**
 * Auth session revoke CLI command.
 * @file Revokes an active session.
 * @module modules/core/auth/cli/session-revoke
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { type SessionRevokeArgs, cliSchemas } from '@/modules/core/auth/utils/cli-validation';
import { z } from 'zod';

export const command: ICLICommand = {
  description: 'Revoke an active session',
  options: [
    {
      name: 'session-id',
      alias: 's',
      type: 'string',
      description: 'Session ID (UUID format)',
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
      const validatedArgs: SessionRevokeArgs = cliSchemas.sessionRevoke.parse(context.args);

      const authService = AuthService.getInstance();
      await authService.initialize();

      await authService.revokeSession(validatedArgs.sessionId);

      const revocationData = {
        sessionId: validatedArgs.sessionId,
        status: 'revoked',
        revokedAt: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(revocationData);
      } else {
        cliOutput.success('Session revoked successfully');
        cliOutput.keyValue({
          'Session ID': revocationData.sessionId,
          'Status': revocationData.status,
          'Revoked At': revocationData.revokedAt
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
        cliOutput.error('Failed to revoke session');
        logger.error(LogSource.AUTH, "Session revoke command error", { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};

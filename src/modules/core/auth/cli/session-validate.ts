/**
 * Auth session validate CLI command.
 * @file Validates a session token.
 * @module modules/core/auth/cli/session-validate
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '../services/auth.service';
import { cliSchemas, type SessionValidateArgs } from '../utils/cli-validation';
import { z } from 'zod';

export const command: ICLICommand = {
  description: 'Validate a session token',
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
      // Validate arguments with Zod
      const validatedArgs: SessionValidateArgs = cliSchemas.sessionValidate.parse(context.args);
      
      // Get AuthService instance
      const authService = AuthService.getInstance();
      await authService.initialize();
      
      // Validate session through service layer
      const validationResult = await authService.validateSession(validatedArgs.sessionId);
      
      const validationData = {
        sessionId: validatedArgs.sessionId,
        valid: validationResult.valid,
        userId: validationResult.userId,
        error: validationResult.error,
        validatedAt: new Date().toISOString()
      };
      
      // Output based on format
      if (validatedArgs.format === 'json') {
        cliOutput.json(validationData);
      } else {
        cliOutput.section('Session Validation Result');
        
        if (validationResult.valid) {
          cliOutput.success('Session is valid');
          cliOutput.keyValue({
            'Session ID': validatedArgs.sessionId,
            'User ID': validationResult.userId || 'Unknown',
            'Status': 'Valid',
            'Validated At': validationData.validatedAt
          });
        } else {
          cliOutput.error('Session is invalid');
          cliOutput.keyValue({
            'Session ID': validatedArgs.sessionId,
            'Status': 'Invalid',
            'Error': validationResult.error || 'Unknown error',
            'Validated At': validationData.validatedAt
          });
        }
      }
      
      // Exit with appropriate code based on validation result
      process.exit(validationResult.valid ? 0 : 1);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Failed to validate session');
        logger.error(LogSource.AUTH, "Session validate command error", { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};
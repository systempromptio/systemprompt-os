/**
 * Auth authenticate CLI command.
 * @file Authenticates user credentials.
 * @module modules/core/auth/cli/authenticate
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '../services/auth.service';
import { cliSchemas, type AuthenticateArgs } from '../utils/cli-validation';
import { z } from 'zod';

export const command: ICLICommand = {
  description: 'Authenticate user credentials',
  options: [
    {
      name: 'email',
      alias: 'e',
      type: 'string',
      description: 'User email address',
      required: true
    },
    {
      name: 'password',
      alias: 'p',
      type: 'string',
      description: 'User password',
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
      const validatedArgs: AuthenticateArgs = cliSchemas.authenticate.parse(context.args);
      
      // Get AuthService instance
      const authService = AuthService.getInstance();
      await authService.initialize();
      
      // Authenticate through service layer
      const authResult = await authService.authenticate(validatedArgs.email, validatedArgs.password);
      
      const authData = {
        success: authResult.success,
        userId: authResult.userId,
        sessionId: authResult.sessionId,
        error: authResult.error,
        authenticatedAt: new Date().toISOString()
      };
      
      // Output based on format
      if (validatedArgs.format === 'json') {
        cliOutput.json(authData);
      } else {
        cliOutput.section('Authentication Result');
        
        if (authResult.success) {
          cliOutput.success('Authentication successful');
          cliOutput.keyValue({
            'User ID': authResult.userId || 'Unknown',
            'Session ID': authResult.sessionId || 'None',
            'Authenticated At': authData.authenticatedAt
          });
        } else {
          cliOutput.error('Authentication failed');
          cliOutput.keyValue({
            'Email': validatedArgs.email,
            'Error': authResult.error || 'Unknown error',
            'Attempted At': authData.authenticatedAt
          });
        }
      }
      
      // Exit with appropriate code based on authentication result
      process.exit(authResult.success ? 0 : 1);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Authentication command failed');
        logger.error(LogSource.AUTH, 'Authenticate command error', { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};
/**
 * Auth providers list CLI command.
 * @file Lists configured OAuth providers.
 * @module modules/core/auth/cli/providers-list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '../services/auth.service';
import { cliSchemas, type ProvidersListArgs } from '../utils/cli-validation';
import { z } from 'zod';

export const command: ICLICommand = {
  description: 'List configured OAuth providers',
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
    const cliOutput = CliOutputService.getInstance();
    const logger = LoggerService.getInstance();

    try {
      // Validate arguments with Zod
      const validatedArgs: ProvidersListArgs = cliSchemas.providersList.parse(context.args);
      
      // Get AuthService instance
      const authService = AuthService.getInstance();
      await authService.initialize();
      
      // Note: Since AuthService doesn't expose provider methods yet,
      // we'll provide a placeholder response indicating the limitation
      const providersData = {
        providers: [],
        message: 'Provider management is currently handled internally by the auth module',
        availableProviders: ['github', 'google'],
        note: 'Direct provider listing through CLI is not yet available',
        timestamp: new Date().toISOString()
      };
      
      // Output based on format
      if (validatedArgs.format === 'json') {
        cliOutput.json(providersData);
      } else {
        cliOutput.section('OAuth Provider Status');
        cliOutput.info('Provider management is currently handled internally by the auth module.');
        cliOutput.info('Available provider types: GitHub, Google');
        cliOutput.info('Direct provider configuration through CLI is not yet available.');
        
        cliOutput.section('Next Steps');
        cliOutput.info('• Provider configuration is managed through YAML files');
        cliOutput.info('• OAuth flows are handled by the auth service');
        cliOutput.info('• Provider instances are created at runtime');
      }
      
      process.exit(0);
    } catch (error) {
      if (error instanceof z.ZodError) {
        cliOutput.error('Invalid arguments:');
        error.errors.forEach(err => {
          cliOutput.error(`  ${err.path.join('.')}: ${err.message}`);
        });
      } else {
        cliOutput.error('Failed to list providers');
        logger.error(LogSource.AUTH, 'Providers list command error', { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};
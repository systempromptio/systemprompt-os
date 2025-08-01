/**
 * Auth providers list CLI command.
 * @file Lists configured OAuth providers.
 * @module modules/core/auth/cli/providers-list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AuthService } from '@/modules/core/auth/services/auth.service';
import { type ProvidersListArgs, cliSchemas } from '@/modules/core/auth/utils/cli-validation';
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
      const validatedArgs: ProvidersListArgs = cliSchemas.providersList.parse(context.args);

      const authService = AuthService.getInstance();
      await authService.initialize();

      const providers = await authService.listProviders();

      const providersData = {
        providers,
        total: providers.length,
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(providersData);
      } else {
        cliOutput.section('OAuth Providers');

        if (providers.length === 0) {
          cliOutput.info('No OAuth providers are currently configured');
          cliOutput.info('Providers can be configured through YAML files in the providers directory');
        } else {
          const tableData = providers.map(provider => { return {
            'Provider ID': provider.id,
            'Name': provider.name,
            'Type': provider.type,
            'Status': provider.enabled ? 'Enabled' : 'Disabled'
          } });

          cliOutput.table(tableData, [
            {
 key: 'Provider ID',
header: 'Provider ID'
},
            {
 key: 'Name',
header: 'Name'
},
            {
 key: 'Type',
header: 'Type'
},
            {
 key: 'Status',
header: 'Status'
}
          ]);

          cliOutput.info(`Total: ${providers.length} provider(s) configured`);
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
        cliOutput.error('Failed to list providers');
        logger.error(LogSource.AUTH, 'Providers list command error', { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    }
  }
};

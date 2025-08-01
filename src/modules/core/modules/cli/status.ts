/**
 * Module status CLI command.
 * @file Module status CLI command.
 * @module modules/core/modules/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { ModulesModuleService } from '@/modules/core/modules/services/modules.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { ModulesType } from '@/modules/core/modules/types/database.generated';

// Command arguments schema
const statusArgsSchema = z.object({
  format: z.enum(['text', 'json']).default('text'),
});

type StatusArgs = z.infer<typeof statusArgsSchema>;

export const command: ICLICommand = {
  description: 'Show module status (enabled/healthy)',
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
      const validatedArgs: StatusArgs = statusArgsSchema.parse(context.args);

      const modulesService = ModulesModuleService.getInstance();

      const modules = await modulesService.exports.getAllModules();
      const healthCheck = await modulesService.exports.healthCheck();

      const statusData = {
        module: 'modules',
        enabled: true,
        healthy: healthCheck.healthy,
        service: 'ModuleManagerService initialized',
        message: healthCheck.message,
        statistics: {
          total: modules.length,
          enabled: modules.filter(m => { return m.enabled }).length,
          disabled: modules.filter(m => { return !m.enabled }).length,
          core: modules.filter(m => { return m.type === 'core' }).length,
          extension: modules.filter(m => { return m.type === ModulesType.EXTENSION }).length
        },
        timestamp: new Date().toISOString()
      };

      if (validatedArgs.format === 'json') {
        cliOutput.json(statusData);
      } else {
        cliOutput.section('Modules Module Status');

        cliOutput.keyValue({
          Module: 'modules',
          Enabled: healthCheck.healthy ? '✓' : '✗',
          Healthy: healthCheck.healthy ? '✓' : '✗',
          Service: 'ModuleManagerService initialized',
          Message: healthCheck.message || 'N/A'
        });

        cliOutput.section('Module Statistics');

        cliOutput.keyValue({
          'Total modules managed': statusData.statistics.total,
          'Enabled modules': statusData.statistics.enabled,
          'Disabled modules': statusData.statistics.disabled,
          'Core modules': statusData.statistics.core,
          'Extension modules': statusData.statistics.extension,
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        cliOutput.error(`Error getting module status: ${errorMessage}`);
        logger.error(LogSource.MODULES, 'Error getting module status', {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
      process.exit(1);
    }
  },
};

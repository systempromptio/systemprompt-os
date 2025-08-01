/**
 * List modules CLI command.
 * @file List modules CLI command.
 * @module modules/core/modules/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { ModulesModuleService } from '@/modules/core/modules/services/modules.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

// Command arguments schema
const listArgsSchema = z.object({
  type: z.enum(['all', 'core', 'extension', 'service', 'daemon', 'plugin']).default('all'),
  format: z.enum(['text', 'json', 'table']).default('text'),
});

type ListArgs = z.infer<typeof listArgsSchema>;

export const command: ICLICommand = {
  description: 'List installed extensions and modules',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Filter by type (all, core, extension, service, daemon, plugin)',
      choices: ['all', 'core', 'extension', 'service', 'daemon', 'plugin'],
      default: 'all'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format (text, json, table)',
      choices: ['text', 'json', 'table'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs: ListArgs = listArgsSchema.parse(context.args);

      const modulesService = ModulesModuleService.getInstance();
      const modules = await modulesService.exports.getAllModules();

      let filteredModules = modules;
      if (validatedArgs.type !== 'all') {
        filteredModules = modules.filter((moduleItem) => {
          return String(moduleItem.type) === validatedArgs.type;
        });
      }

      if (validatedArgs.format === 'json') {
        cliOutput.json(filteredModules);
      } else if (validatedArgs.format === 'table') {
        cliOutput.section('Installed Modules');
        if (filteredModules.length === 0) {
          cliOutput.info('No modules found.');
        } else {
          cliOutput.table(filteredModules, [
            {
 key: 'name',
header: 'Name',
width: 20
},
            {
 key: 'type',
header: 'Type',
width: 12
},
            {
 key: 'version',
header: 'Version',
width: 10
},
            {
 key: 'enabled',
header: 'Status',
width: 10,
format: (v) => { return v ? 'Enabled' : 'Disabled' }
},
            {
 key: 'description',
header: 'Description',
width: 40
}
          ]);
        }
        cliOutput.info(`Total: ${filteredModules.length} modules`);
      } else {
        cliOutput.section('Installed Modules');

        if (filteredModules.length === 0) {
          cliOutput.info('No modules found.');
        } else {
          filteredModules.forEach((moduleItem) => {
            cliOutput.keyValue({
              Name: moduleItem.name,
              Type: String(moduleItem.type),
              Version: moduleItem.version,
              Status: moduleItem.enabled ? 'Enabled' : 'Disabled',
              Path: moduleItem.path,
              Description: moduleItem.description || 'N/A'
            });
            cliOutput.info('─'.repeat(50));
          });
        }

        cliOutput.info(`Total: ${filteredModules.length} modules`);
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
        cliOutput.error(`Error listing modules: ${errorMessage}`);
        logger.error(LogSource.MODULES, `Error listing modules: ${errorMessage}`, {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
      process.exit(1);
    }
  },
};

/**
 * Module setup CLI command.
 * Handles database seeding and maintenance for modules.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { z } from 'zod';
import { ModulesModuleService } from '@/modules/core/modules/services/modules.service';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';

// Command arguments schema
const setupArgsSchema = z.object({
  action: z.enum(['install', 'clean', 'update', 'validate']),
  force: z.boolean().default(false),
  format: z.enum(['text', 'json']).default('text'),
});

type SetupArgs = z.infer<typeof setupArgsSchema>;

export const command: ICLICommand = {
  description: 'Setup and maintain module database',
  options: [
    {
      name: 'action',
      type: 'string',
      description: 'Action to perform',
      choices: ['install', 'clean', 'update', 'validate'],
      required: true
    },
    {
      name: 'force',
      type: 'boolean',
      description: 'Force operation without confirmation',
      default: false
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
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs: SetupArgs = setupArgsSchema.parse(context.args);

      const modulesService = ModulesModuleService.getInstance();

      let result: any = {};

      switch (validatedArgs.action) {
        case 'install':
          cliOutput.info('Installing core modules...');
          await modulesService.exports.setupInstall();
          result = {
            action: 'install',
            success: true,
            message: 'Core modules installed successfully',
            timestamp: new Date().toISOString()
          };
          if (validatedArgs.format === 'json') {
            cliOutput.json(result);
          } else {
            cliOutput.success('Core modules installed successfully');
          }
          break;

        case 'clean':
          if (!validatedArgs.force) {
            const errorMsg = 'Clean operation requires --force flag to confirm data loss';
            result = {
              action: 'clean',
              success: false,
              error: errorMsg,
              timestamp: new Date().toISOString()
            };
            if (validatedArgs.format === 'json') {
              cliOutput.json(result);
            } else {
              cliOutput.error(errorMsg);
            }
            process.exit(1);
          }
          cliOutput.info('Cleaning and rebuilding module database...');
          await modulesService.exports.setupClean();
          result = {
            action: 'clean',
            success: true,
            message: 'Module database rebuilt successfully',
            timestamp: new Date().toISOString()
          };
          if (validatedArgs.format === 'json') {
            cliOutput.json(result);
          } else {
            cliOutput.success('Module database rebuilt successfully');
          }
          break;

        case 'update':
          cliOutput.info('Updating core module definitions...');
          await modulesService.exports.setupUpdate();
          result = {
            action: 'update',
            success: true,
            message: 'Core modules updated successfully',
            timestamp: new Date().toISOString()
          };
          if (validatedArgs.format === 'json') {
            cliOutput.json(result);
          } else {
            cliOutput.success('Core modules updated successfully');
          }
          break;

        case 'validate':
          cliOutput.info('Validating module database...');
          await modulesService.exports.setupValidate();
          result = {
            action: 'validate',
            success: true,
            message: 'Module database validation passed',
            timestamp: new Date().toISOString()
          };
          if (validatedArgs.format === 'json') {
            cliOutput.json(result);
          } else {
            cliOutput.success('Module database validation passed');
          }
          break;
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
        cliOutput.error(`Module setup failed: ${errorMessage}`);
        logger.error(LogSource.MODULES, `Module setup failed: ${errorMessage}`, {
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
      process.exit(1);
    }
  },
};

/**
 * Dev profile create CLI command.
 * @file Dev profile create CLI command.
 * @module dev/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getDevModuleAsync } from '@/modules/core/dev/index';
import type { IDevProfileConfig } from '@/modules/core/dev/types/index';

export const command: ICLICommand = {
  description: 'Create a new development profile',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      description: 'Profile name (required)',
      required: true
    },
    {
      name: 'description',
      alias: 'd',
      type: 'string',
      description: 'Profile description'
    },
    {
      name: 'enabled',
      alias: 'e',
      type: 'boolean',
      description: 'Enable the profile'
    },
    {
      name: 'auto-save',
      alias: 'a',
      type: 'boolean',
      description: 'Enable auto-save'
    },
    {
      name: 'debug',
      type: 'boolean',
      description: 'Enable debug mode'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const name = args.name as string;
      if (!name) {
        cliOutput.error('Profile name is required. Use --name or -n flag.');
        process.exit(1);
      }

      const module = await getDevModuleAsync();
      const service = module.exports.service();

      const config: IDevProfileConfig = {
        enabled: Boolean(args.enabled),
        autoSave: Boolean(args['auto-save']),
        debugMode: Boolean(args.debug)
      };

      const profile = await service.createProfile(name, args.description as string, config);

      cliOutput.success(`Created profile "${profile.name}" with ID: ${profile.id}`);

      cliOutput.section('Profile Details');
      cliOutput.keyValue({
        "ID": profile.id,
        "Name": profile.name,
        "Description": profile.description || 'None',
        "Enabled": profile.config_enabled ? '✓' : '✗',
        'Auto-save': profile.config_auto_save ? '✓' : '✗',
        'Debug mode': profile.config_debug_mode ? '✓' : '✗'
      });

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LogSource.DEV, `Error creating profile: ${errorMessage}`);
      cliOutput.error(`Error creating profile: ${errorMessage}`);
      process.exit(1);
    }
  }
};

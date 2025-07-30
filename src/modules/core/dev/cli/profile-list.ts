/**
 * Dev profile list CLI command.
 * @file Dev profile list CLI command.
 * @module dev/cli
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getDevModuleAsync } from '@/modules/core/dev/index';

export const command: ICLICommand = {
  description: 'List all development profiles',
  execute: async (_context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const module = await getDevModuleAsync();
      const service = module.exports.service();
      const profiles = await service.getAllProfiles();

      if (profiles.length === 0) {
        cliOutput.info('No profiles found. Create one with: dev profile:create <name>');
        process.exit(0);
      }

      cliOutput.section(`Development Profiles (${profiles.length})`);

      const tableData = profiles.map(profile => { return {
        ID: profile.id,
        Name: profile.name,
        Description: profile.description || '-',
        Config: [
          profile.config_enabled ? '✓ enabled' : '',
          profile.config_auto_save ? '✓ auto-save' : '',
          profile.config_debug_mode ? '✓ debug' : ''
        ].filter(Boolean).join(', ') || 'default',
        Created: new Date(profile.created_at ?? '').toLocaleDateString()
      } });

      cliOutput.table(tableData, [
        {
 key: 'Name',
header: 'Name'
},
        {
 key: 'Description',
header: 'Description'
},
        {
 key: 'Created',
header: 'Created'
}
      ]);

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(LogSource.DEV, `Error listing profiles: ${errorMessage}`);
      cliOutput.error(`Error listing profiles: ${errorMessage}`);
      process.exit(1);
    }
  }
};

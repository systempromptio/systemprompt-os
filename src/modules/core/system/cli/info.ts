/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * System info CLI command.
 */

import { Command } from 'commander';
import { SystemService } from '@/modules/core/system/services/system.service';

const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for displaying system information.
 * @returns The configured Commander command.
 */
export const createInfoCommand = (): Command => {
  return new Command('system:info')
    .description('Display system information')
    .option('-f, --format <format>', 'Output format', 'table')
    .action(async (options): Promise<void> => {
      try {
        const service = SystemService.getInstance();
        await service.initialize();

        const info = await service.getSystemInfo();

        if (options.format === 'json') {
          console.log(JSON.stringify(info, null, 2));
          return;
        }

        console.log('System Information:');
        console.log(`  Version: ${info.version}`);
        console.log(`  Environment: ${info.environment}`);
        console.log(`  Uptime: ${info.uptime}s`);
        console.log(`  Hostname: ${info.hostname}`);
        console.log(`  Platform: ${info.platform}`);
        console.log(`  Architecture: ${info.architecture}`);
        console.log(`  Node Version: ${info.node_version}`);
        console.log('');
        console.log('Modules:');
        console.log(`  Total: ${info.modules.total}`);
        console.log(`  Active: ${info.modules.active}`);
        console.log(`  Inactive: ${info.modules.inactive}`);
        console.log(`  Error: ${info.modules.error}`);
      } catch (error) {
        console.error('Error getting system info:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};

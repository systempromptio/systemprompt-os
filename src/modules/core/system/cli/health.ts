/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * System health CLI command.
 */

import { Command } from 'commander';
import { SystemService } from '@/modules/core/system/services/system.service.js';

const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for checking system health.
 * @returns The configured Commander command.
 */
export const createHealthCommand = (): Command => {
  return new Command('system:health')
    .description('Check system health')
    .option('-d, --detailed', 'Show detailed health information')
    .action(async (options): Promise<void> => {
      try {
        const service = SystemService.getInstance();
        await service.initialize();

        const health = await service.checkHealth();

        console.log(`System Health: ${health.status.toUpperCase()}`);
        console.log(`Timestamp: ${health.timestamp.toISOString()}`);

        if (options.detailed || health.status !== 'healthy') {
          console.log('');
          console.log('Health Checks:');
          health.checks.forEach((check): void => {
            const status = check.status === 'pass' ? '✓' : '✗';
            const duration = check.duration ? ` (${check.duration}ms)` : '';
            console.log(`  ${status} ${check.name}${duration}`);
            if (check.message) {
              console.log(`    ${check.message}`);
            }
          });
        }

        if (health.status !== 'healthy') {
          process.exit(ERROR_EXIT_CODE);
        }
      } catch (error) {
        console.error('Error checking health:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
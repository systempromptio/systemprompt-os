/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * List executors CLI command - placeholder implementation.
 */

import { Command } from 'commander';
import { ExecutorService } from '@/modules/core/executors/services/executor.service.js';

const NO_EXECUTORS = 0;
const ERROR_EXIT_CODE = 1;

/**
 * Creates a command for listing executors.
 * @returns The configured Commander command.
 */
export const createListCommand = (): Command => {
  return new Command('executors:list')
    .description('List all executors (placeholder command)')
    .action(async (): Promise<void> => {
      try {
        const service = ExecutorService.getInstance();
        await service.initialize();

        const executors = await service.listExecutors();

        if (executors.length === NO_EXECUTORS) {
          console.log('No executors found.');
          return;
        }

        console.log('Executors:');
        executors.forEach((executor): void => {
          console.log(`- ${executor.name} (${executor.type}): ${executor.status}`);
        });
      } catch (error) {
        console.error('Error listing executors:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};

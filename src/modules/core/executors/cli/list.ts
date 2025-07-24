/** eslint-disable systemprompt-os/no-console-with-help */
/** eslint-disable @typescript-eslint/no-magic-numbers */
/** eslint-disable systemprompt-os/enforce-constants-imports */
/**
 * List executors CLI command - placeholder implementation.
 */

import { Command } from 'commander';
import { ExecutorService } from '@/modules/core/executors/services/executor.service.js';

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
        
        if (executors.length === 0) {
          console.log('No executors found.');
          return;
        }
        
        console.log('Executors:');
        executors.forEach((executor): void => {
          console.log(`- ${executor.name} (${executor.type}): ${executor.status}`);
        });
      } catch (error) {
        console.error('Error listing executors:', error);
        process.exit(1);
      }
    });
};
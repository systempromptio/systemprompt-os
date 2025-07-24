/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Monitor status CLI command.
 */

import { Command } from 'commander';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service.js';

const ERROR_EXIT_CODE = 1;
const PERCENTAGE_FACTOR = 100;
const BYTES_TO_MB = 1024 * 1024;

/**
 * Creates a command for displaying monitor status.
 * @returns The configured Commander command.
 */
export const createStatusCommand = (): Command => {
  return new Command('monitor:status')
    .description('Display current system monitoring status')
    .option('-f, --format <format>', 'Output format', 'table')
    .action(async (options): Promise<void> => {
      try {
        const service = MonitorService.getInstance();
        await service.initialize();

        const stats = await service.getSystemStats();

        if (options.format === 'json') {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }

        console.log('System Monitor Status:');
        console.log('');
        console.log('CPU:');
        console.log(`  Usage: ${stats.cpu.usage.toFixed(2)}%`);
        console.log(`  Load Average: ${stats.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
        console.log('');
        console.log('Memory:');
        console.log(`  Total: ${(stats.memory.total / BYTES_TO_MB).toFixed(2)} MB`);
        console.log(`  Used: ${(stats.memory.used / BYTES_TO_MB).toFixed(2)} MB`);
        console.log(`  Free: ${(stats.memory.free / BYTES_TO_MB).toFixed(2)} MB`);
        console.log(`  Usage: ${stats.memory.percentage.toFixed(2)}%`);
      } catch (error) {
        console.error('Error getting monitor status:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
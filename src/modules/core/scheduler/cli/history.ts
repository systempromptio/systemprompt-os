/**
 * @fileoverview View task execution history command
 * @module modules/core/scheduler/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  execute: async (context: CLIContext): Promise<void> => {
    const { options = {} } = context;
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const schedulerModule = moduleLoader.getModule('scheduler');

    if (!schedulerModule) {
      console.error('Scheduler module not found');
      process.exit(1);
    }

    try {
      const schedulerService = schedulerModule.exports?.SchedulerService;
      if (!schedulerService) {
        console.error('Scheduler service not available');
        process.exit(1);
      }

      const limit = options.limit || 20;
      const executions = await schedulerService.listExecutions(
        options.task,
        options.status,
        limit
      );

      if (executions.length === 0) {
        console.log('No execution history found');
        return;
      }

      console.log('\nTask Execution History:');
      console.log('─'.repeat(110));
      console.log(
        'Execution ID'.padEnd(38) +
        'Task ID'.padEnd(38) +
        'Status'.padEnd(12) +
        'Duration'.padEnd(10) +
        'Started'
      );
      console.log('─'.repeat(110));

      executions.forEach(execution => {
        let duration = 'N/A';
        if (execution.duration) {
          const seconds = Math.floor(execution.duration / 1000);
          duration = `${seconds}s`;
        }

        console.log(
          execution.id.padEnd(38) +
          execution.task_id.padEnd(38) +
          execution.status.padEnd(12) +
          duration.padEnd(10) +
          execution.started_at.toISOString().slice(0, 19)
        );

        if (execution.error) {
          console.log(`  └─ Error: ${execution.error}`);
        }
      });

      console.log('─'.repeat(110));
      console.log(`Total: ${executions.length} executions (limit: ${limit})\n`);

      // Summary by status
      const statusCounts: Record<string, number> = {};
      executions.forEach(exec => {
        statusCounts[exec.status] = (statusCounts[exec.status] || 0) + 1;
      });

      console.log('Summary by Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    } catch (error) {
      console.error('Failed to get execution history:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
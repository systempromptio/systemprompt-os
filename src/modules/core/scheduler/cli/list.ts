/**
 * @fileoverview List scheduled tasks command
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
    
    try {
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      const schedulerModule = moduleLoader.getModule('scheduler');

      if (!schedulerModule) {
        console.error('Scheduler module not found');
        process.exit(1);
      }

      const schedulerService = schedulerModule.exports?.SchedulerService;
      if (!schedulerService) {
        console.error('Scheduler service not available');
        process.exit(1);
      }

      const tasks = await schedulerService.listTasks(options.status);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(tasks, null, 2));
      } else {
        // Table format
        if (tasks.length === 0) {
          console.log('No scheduled tasks found');
          return;
        }

        // Header
        console.log('\nScheduled Tasks:');
        console.log('─'.repeat(120));
        console.log(
          'ID'.padEnd(38) +
          'Name'.padEnd(25) +
          'Type'.padEnd(10) +
          'Schedule'.padEnd(15) +
          'Status'.padEnd(10) +
          'Next Run'.padEnd(20) +
          'Runs'
        );
        console.log('─'.repeat(120));

        // Rows
        tasks.forEach(task => {
          const nextRun = task.next_run ? 
            task.next_run.toISOString().slice(0, 19) : 
            'N/A';
          const runs = `${task.success_count}/${task.run_count}`;
          
          console.log(
            task.id.padEnd(38) +
            task.name.slice(0, 24).padEnd(25) +
            task.type.padEnd(10) +
            task.schedule.slice(0, 14).padEnd(15) +
            task.status.padEnd(10) +
            nextRun.padEnd(20) +
            runs
          );
        });

        console.log('─'.repeat(120));
        console.log(`Total: ${tasks.length} tasks\n`);

        // Stats
        const stats = await schedulerService.getTaskStats();
        console.log('Statistics:');
        console.log(`  Active Tasks: ${stats.active_tasks}`);
        console.log(`  Paused Tasks: ${stats.paused_tasks}`);
        console.log(`  Success Rate: ${stats.success_rate}%`);
        console.log(`  Executions Today: ${stats.executions_today}`);
      }
    } catch (error) {
      console.error('Failed to list scheduled tasks:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
/**
 * @fileoverview Delete scheduled task command
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

    if (!options.id) {
      console.error('Missing required option: --id');
      process.exit(1);
    }

    try {
      const schedulerService = schedulerModule.exports?.SchedulerService;
      if (!schedulerService) {
        console.error('Scheduler service not available');
        process.exit(1);
      }

      // Confirm deletion unless --confirm is provided
      if (!options.confirm) {
        const task = await schedulerService.getTask(options.id);
        if (!task) {
          console.error('Task not found');
          process.exit(1);
        }

        console.log(`\nAre you sure you want to delete this task?`);
        console.log(`ID: ${task.id}`);
        console.log(`Name: ${task.name}`);
        console.log(`Schedule: ${task.schedule}`);
        console.log(`\nThis action cannot be undone.`);
        console.log('\nRe-run with --confirm to delete the task.');
        process.exit(0);
      }

      await schedulerService.deleteTask(options.id);
      console.log(`Task ${options.id} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete task:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
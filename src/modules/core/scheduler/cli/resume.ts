/**
 * @fileoverview Resume scheduled task command
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

      if (options.id) {
        // Resume specific task
        await schedulerService.resumeTask(options.id);
        console.log(`Task ${options.id} resumed successfully`);
      } else {
        // Resume all tasks
        await schedulerService.resumeAll();
        console.log('All scheduled tasks resumed successfully');
      }
    } catch (error) {
      console.error('Failed to resume task(s):', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
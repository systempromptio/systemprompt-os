/**
 * @fileoverview Create scheduled task command
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

    if (!options.name || !options.command || !options.schedule) {
      console.error('Missing required options: --name, --command, and --schedule');
      process.exit(1);
    }

    try {
      const schedulerService = schedulerModule.exports?.SchedulerService;
      if (!schedulerService) {
        console.error('Scheduler service not available');
        process.exit(1);
      }

      let data = {};
      if (options.data) {
        try {
          data = JSON.parse(options.data);
        } catch (e) {
          console.error('Invalid data JSON:', e instanceof Error ? e.message : 'Unknown error');
          process.exit(1);
        }
      }

      const taskData = {
        name: options.name,
        schedule: options.schedule,
        command: options.command,
        data,
        type: options.once ? 'once' as const : undefined
      };

      const task = await schedulerService.createTask(taskData);

      console.log(`Scheduled task created successfully!`);
      console.log(`ID: ${task.id}`);
      console.log(`Name: ${task.name}`);
      console.log(`Type: ${task.type}`);
      console.log(`Schedule: ${task.schedule}`);
      console.log(`Command: ${task.command}`);
      console.log(`Status: ${task.status}`);
      
      if (task.next_run) {
        console.log(`Next Run: ${task.next_run.toISOString()}`);
      }
    } catch (error) {
      console.error('Failed to create scheduled task:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
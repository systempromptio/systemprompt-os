/**
 * @fileoverview Update scheduled task command
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

      const updateData: any = {};
      
      if (options.name !== undefined) {
        updateData.name = options.name;
      }
      
      if (options.schedule !== undefined) {
        updateData.schedule = options.schedule;
      }
      
      if (options.command !== undefined) {
        updateData.command = options.command;
      }

      if (Object.keys(updateData).length === 0) {
        console.error('No update options provided. Use --name, --schedule, or --command');
        process.exit(1);
      }

      const task = await schedulerService.updateTask(options.id, updateData);
      
      if (!task) {
        console.error('Task not found');
        process.exit(1);
      }

      console.log(`Task updated successfully!`);
      console.log(`ID: ${task.id}`);
      console.log(`Name: ${task.name}`);
      console.log(`Schedule: ${task.schedule}`);
      console.log(`Command: ${task.command}`);
      
      if (task.next_run) {
        console.log(`Next Run: ${task.next_run.toISOString()}`);
      }
    } catch (error) {
      console.error('Failed to update task:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
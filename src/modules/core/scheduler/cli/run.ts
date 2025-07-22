/**
 * @fileoverview Run task immediately command
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

      console.log(`Running task ${options.id}...`);
      
      const result = await schedulerService.runTaskNow(options.id);
      
      if (result.success) {
        console.log(`✓ Task completed successfully`);
        console.log(`Duration: ${result.duration}ms`);
        
        if (result.output) {
          console.log(`\nOutput:`);
          console.log(JSON.stringify(result.output, null, 2));
        }
      } else {
        console.error(`✗ Task failed`);
        console.error(`Error: ${result.error}`);
        console.error(`Duration: ${result.duration}ms`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to run task:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
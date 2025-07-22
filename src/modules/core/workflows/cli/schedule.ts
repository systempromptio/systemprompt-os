/**
 * @fileoverview Schedule workflow execution command
 * @module modules/core/workflows/cli
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
    const workflowsModule = moduleLoader.getModule('workflows');

    if (!workflowsModule) {
      console.error('Workflows module not found');
      process.exit(1);
    }

    if (!options.id) {
      console.error('Missing required option: --id');
      process.exit(1);
    }

    if (!options.cron && !options.at) {
      console.error('Either --cron or --at option is required');
      process.exit(1);
    }

    try {
      const workflowService = workflowsModule.exports?.WorkflowService;
      if (!workflowService) {
        console.error('Workflow service not available');
        process.exit(1);
      }

      let params = {};
      if (options.params) {
        try {
          params = JSON.parse(options.params);
        } catch (e) {
          console.error('Invalid params JSON:', e instanceof Error ? e.message : 'Unknown error');
          process.exit(1);
        }
      }

      const scheduleData = {
        workflow_id: options.id,
        schedule: {
          type: options.cron ? 'recurring' as const : 'once' as const,
          cron: options.cron,
          at: options.at ? new Date(options.at) : undefined
        },
        inputs: params
      };

      const scheduleId = await workflowService.scheduleWorkflow(scheduleData);

      console.log(`Workflow scheduled successfully!`);
      console.log(`Schedule ID: ${scheduleId}`);
      console.log(`Workflow ID: ${options.id}`);
      
      if (options.cron) {
        console.log(`Cron Expression: ${options.cron}`);
      } else if (options.at) {
        console.log(`Scheduled At: ${new Date(options.at).toISOString()}`);
      }
    } catch (error) {
      console.error('Failed to schedule workflow:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
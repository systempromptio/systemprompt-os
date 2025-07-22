/**
 * @fileoverview Execute workflow command
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

      const execution = await workflowService.executeWorkflow({
        workflow_id: options.id,
        inputs: params,
        async: options.async !== false
      });

      console.log(`Workflow execution started!`);
      console.log(`Execution ID: ${execution.id}`);
      console.log(`Workflow ID: ${execution.workflow_id}`);
      console.log(`Status: ${execution.status}`);
      
      if (options.async === false) {
        console.log(`\nExecution completed`);
        if (execution.outputs) {
          console.log(`Outputs: ${JSON.stringify(execution.outputs, null, 2)}`);
        }
      } else {
        console.log(`\nUse 'systemprompt workflows:status --execution ${execution.id}' to check status`);
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
/**
 * @fileoverview Check workflow execution status command
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

    if (!options.execution) {
      console.error('Missing required option: --execution');
      process.exit(1);
    }

    try {
      const workflowService = workflowsModule.exports?.WorkflowService;
      if (!workflowService) {
        console.error('Workflow service not available');
        process.exit(1);
      }

      const execution = await workflowService.getExecution(options.execution);
      if (!execution) {
        console.error('Execution not found');
        process.exit(1);
      }

      console.log('\nExecution Status:');
      console.log('─'.repeat(50));
      console.log(`ID: ${execution.id}`);
      console.log(`Workflow ID: ${execution.workflow_id}`);
      console.log(`Version: ${execution.workflow_version}`);
      console.log(`Status: ${execution.status}`);
      console.log(`Started: ${execution.started_at.toISOString()}`);
      
      if (execution.completed_at) {
        console.log(`Completed: ${execution.completed_at.toISOString()}`);
        if (execution.duration) {
          const seconds = Math.floor(execution.duration / 1000);
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          console.log(`Duration: ${minutes}m ${remainingSeconds}s`);
        }
      }

      if (execution.current_step) {
        console.log(`Current Step: ${execution.current_step}`);
      }

      if (execution.error) {
        console.log(`\nError: ${execution.error}`);
      }

      if (options.detailed) {
        console.log('\nStep Results:');
        Object.entries(execution.context.step_results).forEach(([stepId, result]: [string, any]) => {
          console.log(`\n  Step: ${stepId}`);
          console.log(`  Status: ${result.status}`);
          console.log(`  Started: ${result.started_at}`);
          if (result.completed_at) {
            console.log(`  Completed: ${result.completed_at}`);
          }
          if (result.error) {
            console.log(`  Error: ${result.error}`);
          }
          if (result.outputs && Object.keys(result.outputs).length > 0) {
            console.log(`  Outputs: ${JSON.stringify(result.outputs, null, 4)}`);
          }
        });

        if (execution.checkpoints.length > 0) {
          console.log(`\nCheckpoints: ${execution.checkpoints.length}`);
        }
      }

      if (execution.outputs && Object.keys(execution.outputs).length > 0) {
        console.log('\nOutputs:');
        console.log(JSON.stringify(execution.outputs, null, 2));
      }

      console.log('─'.repeat(50));
    } catch (error) {
      console.error('Failed to get execution status:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
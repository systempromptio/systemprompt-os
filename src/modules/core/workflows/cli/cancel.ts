/**
 * @fileoverview Cancel workflow execution command
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

      await workflowService.cancelExecution(options.execution, options.force || false);
      console.log(`Workflow execution ${options.execution} cancelled successfully`);
    } catch (error) {
      console.error('Failed to cancel execution:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
/**
 * @fileoverview Export workflow definition command
 * @module modules/core/workflows/cli
 */

import { getModuleLoader } from '../../../loader.js';
import { writeFileSync } from 'fs';

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

      const workflow = await workflowService.getWorkflow(options.id);
      if (!workflow) {
        console.error('Workflow not found');
        process.exit(1);
      }

      const exportData = workflowService.exportWorkflow(workflow);

      if (options.output) {
        // Write to file
        writeFileSync(options.output, exportData, 'utf-8');
        console.log(`Workflow exported to: ${options.output}`);
      } else {
        // Output to console
        console.log(exportData);
      }
    } catch (error) {
      console.error('Failed to export workflow:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
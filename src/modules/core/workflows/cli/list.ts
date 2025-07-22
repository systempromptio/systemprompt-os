/**
 * @fileoverview List workflows command
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
    
    try {
      const moduleLoader = getModuleLoader();
      await moduleLoader.loadModules();
      const workflowsModule = moduleLoader.getModule('workflows');

      if (!workflowsModule) {
        console.error('Workflows module not found');
        process.exit(1);
      }

      const workflowService = workflowsModule.exports?.WorkflowService;
      if (!workflowService) {
        console.error('Workflow service not available');
        process.exit(1);
      }

      const workflows = await workflowService.listWorkflows(options.status);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(workflows, null, 2));
      } else {
        // Table format
        if (workflows.length === 0) {
          console.log('No workflows found');
          return;
        }

        // Header
        console.log('\nWorkflows:');
        console.log('─'.repeat(100));
        console.log(
          'ID'.padEnd(38) +
          'Name'.padEnd(25) +
          'Version'.padEnd(10) +
          'Status'.padEnd(12) +
          'Steps'.padEnd(8) +
          'Created'
        );
        console.log('─'.repeat(100));

        // Rows
        workflows.forEach(workflow => {
          console.log(
            workflow.id.padEnd(38) +
            workflow.name.slice(0, 24).padEnd(25) +
            workflow.version.padEnd(10) +
            workflow.status.padEnd(12) +
            String(workflow.steps.length).padEnd(8) +
            workflow.created_at.toISOString().slice(0, 19)
          );
        });

        console.log('─'.repeat(100));
        console.log(`Total: ${workflows.length} workflows\n`);
      }
    } catch (error) {
      console.error('Failed to list workflows:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
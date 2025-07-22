/**
 * @fileoverview View workflow execution history command
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

    try {
      const workflowService = workflowsModule.exports?.WorkflowService;
      if (!workflowService) {
        console.error('Workflow service not available');
        process.exit(1);
      }

      const limit = options.limit || 20;
      const executions = await workflowService.listExecutions(
        options.workflow,
        options.status,
        limit
      );

      if (executions.length === 0) {
        console.log('No executions found');
        return;
      }

      console.log('\nWorkflow Execution History:');
      console.log('─'.repeat(120));
      console.log(
        'Execution ID'.padEnd(38) +
        'Workflow ID'.padEnd(38) +
        'Status'.padEnd(12) +
        'Duration'.padEnd(12) +
        'Started'
      );
      console.log('─'.repeat(120));

      executions.forEach(execution => {
        let duration = 'N/A';
        if (execution.duration) {
          const seconds = Math.floor(execution.duration / 1000);
          duration = `${seconds}s`;
        }

        console.log(
          execution.id.padEnd(38) +
          execution.workflow_id.padEnd(38) +
          execution.status.padEnd(12) +
          duration.padEnd(12) +
          execution.started_at.toISOString().slice(0, 19)
        );
      });

      console.log('─'.repeat(120));
      console.log(`Total: ${executions.length} executions (limit: ${limit})\n`);

      // Summary by status
      const statusCounts: Record<string, number> = {};
      executions.forEach(exec => {
        statusCounts[exec.status] = (statusCounts[exec.status] || 0) + 1;
      });

      console.log('Summary by Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    } catch (error) {
      console.error('Failed to get execution history:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
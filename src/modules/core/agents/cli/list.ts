/**
 * @fileoverview List agents command
 * @module modules/core/agents/cli
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
      const agentsModule = moduleLoader.getModule('agents');

      if (!agentsModule) {
        console.error('Agents module not found');
        process.exit(1);
      }

      const agentService = agentsModule.exports?.AgentService;
      if (!agentService) {
        console.error('Agent service not available');
        process.exit(1);
      }

      const agents = await agentService.listAgents(options.status);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(agents, null, 2));
      } else {
        // Table format
        if (agents.length === 0) {
          console.log('No agents found');
          return;
        }

        // Header
        console.log('\nAgents:');
        console.log('─'.repeat(100));
        console.log(
          'ID'.padEnd(38) +
          'Name'.padEnd(20) +
          'Type'.padEnd(12) +
          'Status'.padEnd(10) +
          'Tasks (A/C/F)'.padEnd(15) +
          'Created'
        );
        console.log('─'.repeat(100));

        // Rows
        agents.forEach(agent => {
          const tasks = `${agent.assigned_tasks}/${agent.completed_tasks}/${agent.failed_tasks}`;
          console.log(
            agent.id.padEnd(38) +
            agent.name.slice(0, 19).padEnd(20) +
            agent.type.padEnd(12) +
            agent.status.padEnd(10) +
            tasks.padEnd(15) +
            agent.created_at.toISOString().slice(0, 19)
          );
        });

        console.log('─'.repeat(100));
        console.log(`Total: ${agents.length} agents\n`);
      }
    } catch (error) {
      console.error('Failed to list agents:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
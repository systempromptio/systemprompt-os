/**
 * @fileoverview List agents CLI command
 * @module modules/core/agents/cli
 */

import { getModuleLoader } from '../../../loader.js';
import Table from 'cli-table3';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
  module?: any;
}

export const command = {
  description: 'List all agents',
  options: {
    status: {
      short: 's',
      description: 'Filter by status (active, idle, stopped)'
    },
    format: {
      short: 'f',
      description: 'Output format (json, table)'
    }
  },
  execute: async (context: CLIContext): Promise<void> => {
    const { options = {} } = context;
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const agentsModule = moduleLoader.getModule('agents');

    if (!agentsModule) {
      console.error('Agents module not found');
      process.exit(1);
    }

    // Get the module instance
    const module = agentsModule.exports;
    if (!module || typeof module.listAgents !== 'function') {
      console.error('Agents module does not expose listAgents method');
      process.exit(1);
    }

    try {
      const filter: any = {};
      if (options['status']) {
        filter['status'] = options['status'];
      }

      const agents = await module.listAgents(filter);

      if (options['format'] === 'json') {
        console.log(JSON.stringify(agents, null, 2));
      } else {
        if (agents.length === 0) {
          console.log('No agents found');
          return;
        }

        const table = new Table({
          head: ['ID', 'Name', 'Type', 'Status', 'Tasks', 'Created'],
          colWidths: [38, 20, 15, 10, 25, 20]
        });

        for (const agent of agents) {
          const tasks = `✓ ${agent.completed_tasks} | ✗ ${agent.failed_tasks} | → ${agent.assigned_tasks}`;
          table.push([
            agent.id,
            agent.name,
            agent.type,
            agent.status,
            tasks,
            agent.created_at.toLocaleString()
          ]);
        }

        console.log(table.toString());
        console.log(`\nTotal: ${agents.length} agent(s)`);
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
};
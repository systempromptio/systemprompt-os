/**
 * @fileoverview Assign task to agent command
 * @module modules/core/agents/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Assign a task to an agent',
  options: {
    agent: {
      short: 'a',
      description: 'ID of the agent to assign the task to',
    },
    type: {
      short: 't',
      description: 'Type of task',
    },
    priority: {
      short: 'p',
      description: 'Task priority (low, medium, high)',
    },
    data: {
      short: 'd',
      description: 'Task data (JSON format)',
    },
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

    if (!options['agent'] || !options['task']) {
      console.error('Missing required options: --agent and --task');
      process.exit(1);
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    const priority = options['priority'] || 'medium';

    if (!validPriorities.includes(priority)) {
      console.error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      process.exit(1);
    }

    try {
      const agentService = agentsModule.exports?.AgentService;
      if (!agentService) {
        console.error('Agent service not available');
        process.exit(1);
      }

      // Create task payload
      const taskData = {
        agent_id: options['agent'],
        name: options['task'],
        description: options['description'],
        priority: priority,
        payload: {
          taskName: options['task'],
          createdAt: new Date().toISOString(),
        },
      };

      const task = await agentService.assignTask(taskData);

      console.log(`Task assigned successfully!`);
      console.log(`Task ID: ${task.id}`);
      console.log(`Agent ID: ${task.agent_id}`);
      console.log(`Task Name: ${task.name}`);
      console.log(`Priority: ${task.priority}`);
      console.log(`Status: ${task.status}`);
    } catch (error) {
      console.error(
        'Failed to assign task:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  },
};

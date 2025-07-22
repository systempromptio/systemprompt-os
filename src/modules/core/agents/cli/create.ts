/**
 * @fileoverview Create agent command
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
    
    const moduleLoader = getModuleLoader();
    await moduleLoader.loadModules();
    const agentsModule = moduleLoader.getModule('agents');

    if (!agentsModule) {
      console.error('Agents module not found');
      process.exit(1);
    }

    if (!options.name || !options.type) {
      console.error('Missing required options: --name and --type');
      process.exit(1);
    }

    const validTypes = ['worker', 'scheduler', 'monitor', 'custom'];
    if (!validTypes.includes(options.type)) {
      console.error(`Invalid agent type. Must be one of: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    try {
      const agentService = agentsModule.exports?.AgentService;
      if (!agentService) {
        console.error('Agent service not available');
        process.exit(1);
      }

      let config = {};
      if (options.config) {
        try {
          config = JSON.parse(options.config);
        } catch (e) {
          console.error('Invalid config JSON:', e instanceof Error ? e.message : 'Unknown error');
          process.exit(1);
        }
      }

      const agent = await agentService.createAgent({
        name: options.name,
        type: options.type,
        config
      });

      console.log(`Agent created successfully!`);
      console.log(`ID: ${agent.id}`);
      console.log(`Name: ${agent.name}`);
      console.log(`Type: ${agent.type}`);
      console.log(`Status: ${agent.status}`);
    } catch (error) {
      console.error('Failed to create agent:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
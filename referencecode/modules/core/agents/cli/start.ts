/**
 * @fileoverview Start agent command
 * @module modules/core/agents/cli
 */

import { getModuleLoader } from '../../../loader.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'Start an agent',
  options: {
    id: {
      short: 'i',
      description: 'ID of the agent to start',
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

    if (!options['id']) {
      console.error('Missing required option: --id');
      process.exit(1);
    }

    try {
      const agentService = agentsModule.exports?.AgentService;
      if (!agentService) {
        console.error('Agent service not available');
        process.exit(1);
      }

      await agentService.startAgent(options['id']);
      console.log(`Agent ${options['id']} started successfully`);
    } catch (error) {
      console.error(
        'Failed to start agent:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  },
};

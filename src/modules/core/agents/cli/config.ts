/**
 * @fileoverview Configure agent command
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

    if (!options.id || !options.key || !options.value) {
      console.error('Missing required options: --id, --key, and --value');
      process.exit(1);
    }

    try {
      const agentService = agentsModule.exports?.AgentService;
      if (!agentService) {
        console.error('Agent service not available');
        process.exit(1);
      }

      const agent = await agentService.getAgent(options.id);
      if (!agent) {
        console.error('Agent not found');
        process.exit(1);
      }

      // Parse value if it looks like JSON
      let value: any = options.value;
      if (options.value.startsWith('{') || options.value.startsWith('[') || 
          options.value === 'true' || options.value === 'false' ||
          !isNaN(Number(options.value))) {
        try {
          value = JSON.parse(options.value);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }

      // Update config
      const newConfig = { ...agent.config };
      
      // Support nested keys using dot notation
      const keys = options.key.split('.');
      let target = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) {
          target[keys[i]] = {};
        }
        target = target[keys[i]];
      }
      
      target[keys[keys.length - 1]] = value;

      await agentService.updateAgent(options.id, { config: newConfig });

      console.log(`Agent configuration updated successfully`);
      console.log(`Key: ${options.key}`);
      console.log(`Value: ${JSON.stringify(value)}`);
    } catch (error) {
      console.error('Failed to configure agent:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
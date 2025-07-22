/**
 * @fileoverview Get agent status command
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

    if (!options.id) {
      console.error('Missing required option: --id');
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

      const tasks = await agentService.listTasks(options.id);
      const runningTasks = tasks.filter(t => t.status === 'running');
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'assigned');

      console.log('\nAgent Status:');
      console.log('─'.repeat(50));
      console.log(`ID: ${agent.id}`);
      console.log(`Name: ${agent.name}`);
      console.log(`Type: ${agent.type}`);
      console.log(`Status: ${agent.status}`);
      console.log(`Created: ${agent.created_at.toISOString()}`);
      console.log(`Updated: ${agent.updated_at.toISOString()}`);
      if (agent.last_heartbeat) {
        console.log(`Last Heartbeat: ${agent.last_heartbeat.toISOString()}`);
      }
      console.log('\nTask Statistics:');
      console.log(`  Assigned: ${agent.assigned_tasks}`);
      console.log(`  Completed: ${agent.completed_tasks}`);
      console.log(`  Failed: ${agent.failed_tasks}`);
      console.log(`  Currently Running: ${runningTasks.length}`);
      console.log(`  Pending: ${pendingTasks.length}`);
      
      if (agent.capabilities && agent.capabilities.length > 0) {
        console.log('\nCapabilities:');
        agent.capabilities.forEach(cap => console.log(`  - ${cap}`));
      }

      if (Object.keys(agent.config).length > 0) {
        console.log('\nConfiguration:');
        console.log(JSON.stringify(agent.config, null, 2));
      }

      console.log('─'.repeat(50));
    } catch (error) {
      console.error('Failed to get agent status:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
};
/**
 * @fileoverview View agent logs command
 * @module modules/core/agents/cli
 */

import { getModuleLoader } from '../../../loader.js';
import type { AgentLog } from '../types/agent.types.js';

export interface CLIContext {
  cwd: string;
  args: Record<string, any>;
  options?: Record<string, any>;
}

export const command = {
  description: 'View agent logs',
  options: {
    id: {
      short: 'i',
      description: 'ID of the agent',
    },
    lines: {
      short: 'n',
      description: 'Number of lines to show',
    },
    follow: {
      short: 'f',
      description: 'Follow log output',
    },
    level: {
      short: 'l',
      description: 'Filter by log level (info, warn, error)',
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

      const limit = options['lines'] || 50;
      const logs = await agentService.getAgentLogs(options['id'], limit);

      if (logs.length === 0) {
        console.log('No logs found for this agent');
        return;
      }

      console.log(`\nAgent Logs (last ${limit} entries):`);
      console.log('─'.repeat(80));

      logs.forEach((log: AgentLog) => {
        const timestamp = log.timestamp.toISOString().slice(0, 19);
        const levelColor =
          {
            debug: '\x1b[90m',
            info: '\x1b[0m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
          }[log.level] || '\x1b[0m';

        console.log(
          `${timestamp} ${levelColor}[${log.level.toUpperCase().padEnd(5)}]\x1b[0m ${log.message}`,
        );

        if (log.context && Object.keys(log.context).length > 0) {
          console.log(`  Context: ${JSON.stringify(log.context)}`);
        }
      });

      console.log('─'.repeat(80));

      if (options['follow']) {
        console.log('\nFollowing logs... (Press Ctrl+C to stop)');
        // In a real implementation, this would set up a log stream
        // For now, we'll just indicate the feature
        console.log('Note: Real-time log following not yet implemented');
      }
    } catch (error) {
      console.error(
        'Failed to get agent logs:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  },
};

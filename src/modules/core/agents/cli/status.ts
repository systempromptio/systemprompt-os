/**
 * Agents module status CLI command.
 * @file Agents module status CLI command.
 * @module modules/core/agents/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { AgentService } from '@/modules/core/agents/services/agent.service';

export const command: ICLICommand = {
  description: 'Show agents module status (enabled/healthy)',
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    logger.debug(LogSource.AGENT, 'Executing agents status command', { context });

    try {
      const agentService = AgentService.getInstance();
      
      // Test service health by attempting to list agents
      await agentService.listAgents();
      
      cliOutput.section('Agents Module Status');

      cliOutput.keyValue({
        Module: 'agents',
        Enabled: '✓',
        Healthy: '✓',
        Service: 'AgentService initialized',
        Message: 'Module is operational',
      });

      cliOutput.section('Capabilities');
      cliOutput.keyValue({
        'Agent management': '✓',
        'Task execution': '✓',
        'State persistence': '✓',
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error(`Error getting agents status: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(LogSource.AGENT, 'Error getting agents status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};

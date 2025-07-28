/**
 * Agents module status CLI command.
 * @file Agents module status CLI command.
 * @module modules/core/agents/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { getAgentsModule } from '@/modules/core/agents/index';

export const command: ICLICommand = {
  description: 'Show agents module status (enabled/healthy)',
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    logger.debug(LogSource.AGENT, 'Executing agents status command', { context });

    try {
      const agentsModule = getAgentsModule();
      const healthStatus = typeof agentsModule.healthCheck === 'function'
        ? await agentsModule.healthCheck()
        : {
            healthy: false,
            message: 'Health check not available'
          };

      cliOutput.section('Agents Module Status');

      cliOutput.keyValue({
        Module: 'agents',
        Enabled: '✓',
        Healthy: healthStatus.healthy ? '✓' : '✗',
        Service: 'AgentService initialized',
        Message: healthStatus.message ?? 'Module is operational',
      });

      cliOutput.section('Capabilities');
      cliOutput.keyValue({
        'Agent management': '✓',
        'Task execution': '✓',
        'State persistence': '✓',
      });

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error getting agents status');
      logger.error(LogSource.AGENT, 'Error getting agents status', {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      process.exit(1);
    }
  },
};

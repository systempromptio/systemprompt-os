/**
 * Agents module status CLI command.
 * @file Agents module status CLI command.
 * @module modules/core/agents/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { AgentsService } from '@/modules/core/agents/services/agents.service';

/**
 * Display module status information.
 * @param cliOutput - CLI output service instance.
 * @param isHealthy - Whether the module is healthy.
 */
const displayModuleStatus = (cliOutput: CliOutputService, isHealthy: boolean): void => {
  cliOutput.section('Agents Module Status');
  cliOutput.keyValue({
    Module: 'agents',
    Enabled: '✓',
    Healthy: isHealthy ? '✓' : '✗',
    Service: 'AgentService initialized',
    Message: isHealthy ? 'Module is operational' : 'Module available but not monitoring',
  });
};

/**
 * Display module capabilities.
 * @param cliOutput - CLI output service instance.
 */
function displayCapabilities(cliOutput: CliOutputService): void {
  cliOutput.section('Capabilities');
  cliOutput.keyValue({
    'Agent management': '✓',
    'Task execution': '✓',
    'State persistence': '✓',
  });
}

/**
 * Display agent statistics.
 * @param cliOutput - CLI output service instance.
 * @param agentService - Agent service instance.
 * @param logger - Logger instance.
 * @returns Promise that resolves when statistics are displayed.
 */
async function displayStatistics(
  cliOutput: CliOutputService,
  agentService: AgentsService,
  logger: ILogger
): Promise<void> {
  try {
    const agents = await agentService.listAgents('');
    displayStatisticsSection(cliOutput, agents.length);
  } catch (error) {
    logStatisticsError(logger, error);
  }
}

/**
 * Displays the statistics section.
 * @param cliOutput - CLI output service instance.
 * @param agentCount - Number of agents.
 */
function displayStatisticsSection(cliOutput: CliOutputService, agentCount: number): void {
  cliOutput.section('Statistics');
  cliOutput.keyValue({
    'Total agents': agentCount.toString(),
  });
}

/**
 * Logs statistics error.
 * @param logger - Logger instance.
 * @param error - Error to log.
 */
function logStatisticsError(logger: ILogger, error: unknown): void {
  logger.debug(LogSource.AGENT, 'Could not list agents for status (non-critical)', {
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Handles status command errors.
 * @param cliOutput - CLI output service instance.
 * @param logger - Logger instance.
 * @param error - Error to handle.
 */
function handleStatusError(cliOutput: CliOutputService, logger: ILogger, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  cliOutput.error(`Error getting agents status: ${errorMessage}`);
  logger.error(LogSource.AGENT, 'Error getting agents status', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
}

export const command: ICLICommand = {
  description: 'Show agents module status (enabled/healthy)',
  execute: async (context: ICLIContext): Promise<void> => {
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    logger.debug(LogSource.AGENT, 'Executing agents status command', { context });

    try {
      const agentService = AgentsService.getInstance();
      const isHealthy = agentService.isHealthy();

      displayModuleStatus(cliOutput, isHealthy);
      displayCapabilities(cliOutput);
      await displayStatistics(cliOutput, agentService, logger);

      process.exit(0);
    } catch (error) {
      handleStatusError(cliOutput, logger, error);
      process.exit(1);
    }
  },
};

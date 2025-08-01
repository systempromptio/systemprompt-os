/**
 * Agents module status CLI command.
 * @file Agents module status CLI command.
 * @module modules/core/agents/cli/status
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { type ILogger, LogSource } from '@/modules/core/logger/types/index';
import { AgentsService } from '@/modules/core/agents/services/agents.service';
import { statusCommandArgsSchema } from '@/modules/core/agents/cli/schemas';
import { ZodError } from 'zod';

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
const displayCapabilities = (cliOutput: CliOutputService): void => {
  cliOutput.section('Capabilities');
  cliOutput.keyValue({
    'Agent management': '✓',
    'Task execution': '✓',
    'State persistence': '✓',
  });
}

/**
 * Logs statistics error.
 * @param logger - Logger instance.
 * @param error - Error to log.
 */
const logStatisticsError = (logger: ILogger, error: unknown): void => {
  logger.debug(LogSource.AGENT, 'Could not list agents for status (non-critical)', {
    error: error instanceof Error ? error.message : String(error),
  });
};

/**
 * Displays the statistics section.
 * @param cliOutput - CLI output service instance.
 * @param agentCount - Number of agents.
 */
const displayStatisticsSection = (cliOutput: CliOutputService, agentCount: number): void => {
  cliOutput.section('Statistics');
  cliOutput.keyValue({
    'Total agents': agentCount.toString(),
  });
};

/**
 * Display agent statistics.
 * @param cliOutput - CLI output service instance.
 * @param agentService - Agent service instance.
 * @param logger - Logger instance.
 * @returns Promise that resolves when statistics are displayed.
 */
const displayStatistics = async (
  cliOutput: CliOutputService,
  agentService: AgentsService,
  logger: ILogger
): Promise<void> => {
  try {
    const agents = await agentService.listAgents('');
    displayStatisticsSection(cliOutput, agents.length);
  } catch (error) {
    logStatisticsError(logger, error);
  }
};

/**
 * Displays status information in JSON format.
 * @param cliOutput - CLI output service instance.
 * @param agentService - Agent service instance.
 * @param isHealthy - Whether the module is healthy.
 * @param logger - Logger instance.
 * @returns Promise that resolves when status is displayed.
 */
const displayStatusAsJson = async (
  cliOutput: CliOutputService,
  agentService: AgentsService,
  isHealthy: boolean,
  logger: ILogger
): Promise<void> => {
  try {
    const agents = await agentService.listAgents('');
    const statusData = {
      module: 'agents',
      enabled: true,
      healthy: isHealthy,
      service: 'AgentService initialized',
      message: isHealthy ? 'Module is operational' : 'Module available but not monitoring',
      capabilities: {
        agent_management: true,
        task_execution: true,
        state_persistence: true
      },
      statistics: {
        total_agents: agents.length
      }
    };
    cliOutput.json(statusData);
  } catch (error) {
    const statusData = {
      module: 'agents',
      enabled: true,
      healthy: isHealthy,
      service: 'AgentService initialized',
      message: isHealthy ? 'Module is operational' : 'Module available but not monitoring',
      capabilities: {
        agent_management: true,
        task_execution: true,
        state_persistence: true
      },
      statistics: {
        total_agents: 0
      }
    };
    cliOutput.json(statusData);
    logger.debug(LogSource.AGENT, 'Could not list agents for status (non-critical)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handles status command errors.
 * @param cliOutput - CLI output service instance.
 * @param logger - Logger instance.
 * @param error - Error to handle.
 */
const handleStatusError = (cliOutput: CliOutputService, logger: ILogger, error: unknown): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  cliOutput.error(`Error getting agents status: ${errorMessage}`);
  logger.error(LogSource.AGENT, 'Error getting agents status', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
}

/**
 * Executes the status display logic.
 * @param format - Output format.
 * @param agentService - Agent service instance.
 * @param isHealthy - Whether the module is healthy.
 * @param cliOutput - CLI output service.
 * @param logger - Logger instance.
 */
const executeStatusDisplay = async (
  format: string,
  agentService: AgentsService,
  isHealthy: boolean,
  cliOutput: CliOutputService,
  logger: ILogger
): Promise<void> => {
  if (format === 'json') {
    await displayStatusAsJson(cliOutput, agentService, isHealthy, logger);
  } else {
    displayModuleStatus(cliOutput, isHealthy);
    displayCapabilities(cliOutput);
    await displayStatistics(cliOutput, agentService, logger);
  }
};

export const command: ICLICommand = {
  description: 'Show agents module status (enabled/healthy)',
  options: [
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const { args } = context;
    const logger = LoggerService.getInstance();
    const cliOutput = CliOutputService.getInstance();

    try {
      const validatedArgs = statusCommandArgsSchema.parse(args);

      const agentService = AgentsService.getInstance();
      const isHealthy = agentService.isHealthy();

      await executeStatusDisplay(validatedArgs.format, agentService, isHealthy, cliOutput, logger);
      process.exit(0);
    } catch (error) {
      if (error instanceof ZodError) {
        if (args.format === 'json') {
          cliOutput.json({
            success: false,
            message: 'Invalid arguments',
            errors: error.errors.map(err => { return {
              field: err.path.join('.'),
              message: err.message
            } })
          });
        } else {
          cliOutput.error('Invalid arguments:');
          error.errors.forEach(err => {
            const field = err.path.length > 0 ? err.path.join('.') : 'argument';
            cliOutput.error(`  ${field}: ${err.message}`);
          });
        }
        process.exit(1);
      } else {
        handleStatusError(cliOutput, logger, error);
        process.exit(1);
      }
    }
  },
};

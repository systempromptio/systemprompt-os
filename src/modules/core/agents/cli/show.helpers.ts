/**
 * Helper functions for agent show CLI.
 * @file Helper functions for agent show CLI.
 * @module modules/core/agents/cli/show-helpers
 */

import type { IAgent } from '@/modules/core/agents/types/agent.types';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';

/**
 * Displays basic agent information.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayBasicInfo = (agent: IAgent, cliOutput: CliOutputService): void => {
  cliOutput.section('Agent Details');
  cliOutput.keyValue({
    ID: agent.id,
    Name: agent.name,
    Description: agent.description,
    Type: agent.type,
    Status: agent.status,
    Created: new Date(agent.created_at).toISOString(),
    Updated: new Date(agent.updated_at).toISOString()
  });
};

/**
 * Displays agent capabilities if any.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayCapabilities = (agent: IAgent, cliOutput: CliOutputService): void => {
  if (agent.capabilities.length > 0) {
    cliOutput.section('Capabilities');
    agent.capabilities.forEach((cap: string): void => {
      cliOutput.info(`• ${cap}`);
    });
  }
};

/**
 * Displays agent tools if any.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayTools = (agent: IAgent, cliOutput: CliOutputService): void => {
  if (agent.tools.length > 0) {
    cliOutput.section('Tools');
    agent.tools.forEach((tool: string): void => {
      cliOutput.info(`• ${tool}`);
    });
  }
};

/**
 * Displays agent configuration if any.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayConfiguration = (agent: IAgent, cliOutput: CliOutputService): void => {
  if (Object.keys(agent.config).length > 0) {
    cliOutput.section('Configuration');
    cliOutput.info(JSON.stringify(agent.config, null, 2));
  }
};

/**
 * Displays task metrics.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayMetrics = (agent: IAgent, cliOutput: CliOutputService): void => {
  cliOutput.section('Task Metrics');
  cliOutput.keyValue({
    'Assigned Tasks': agent.assigned_tasks.toString(),
    'Completed Tasks': agent.completed_tasks.toString(),
    'Failed Tasks': agent.failed_tasks.toString()
  });
};

/**
 * Displays agent details in a formatted way.
 * @param agent - Agent to display.
 */
export const displayAgentDetails = (agent: IAgent): void => {
  const cliOutput = CliOutputService.getInstance();

  displayBasicInfo(agent, cliOutput);
  cliOutput.section('Instructions');
  cliOutput.info(agent.instructions);
  displayCapabilities(agent, cliOutput);
  displayTools(agent, cliOutput);
  displayConfiguration(agent, cliOutput);
  displayMetrics(agent, cliOutput);
};

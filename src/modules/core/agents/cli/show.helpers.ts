/**
 * Helper functions for agent show CLI.
 * @file Helper functions for agent show CLI.
 * @module modules/core/agents/cli/show-helpers
 */

import type { IAgent } from '@/modules/core/agents/types/agents.module.generated';
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
    Created: agent.created_at !== null ? new Date(agent.created_at).toISOString() : 'N/A',
    Updated: agent.updated_at !== null ? new Date(agent.updated_at).toISOString() : 'N/A'
  });
};

/**
 * Displays agent capabilities if any.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayCapabilities = (_agent: IAgent, cliOutput: CliOutputService): void => {
  // Note: capabilities are stored in separate table - would need to be fetched separately
  // For now, show a placeholder section
  cliOutput.section('Capabilities');
  cliOutput.info('• Capabilities stored separately (not fetched in basic agent view)');
};

/**
 * Displays agent tools if any.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayTools = (_agent: IAgent, cliOutput: CliOutputService): void => {
  // Note: tools are stored in separate table - would need to be fetched separately
  // For now, show a placeholder section
  cliOutput.section('Tools');
  cliOutput.info('• Tools stored separately (not fetched in basic agent view)');
};

/**
 * Displays agent configuration if any.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayConfiguration = (_agent: IAgent, cliOutput: CliOutputService): void => {
  // Note: config is stored in separate table - would need to be fetched separately
  // For now, show a placeholder section
  cliOutput.section('Configuration');
  cliOutput.info('• Configuration stored separately (not fetched in basic agent view)');
};

/**
 * Displays task metrics.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayMetrics = (agent: IAgent, cliOutput: CliOutputService): void => {
  cliOutput.section('Task Metrics');
  cliOutput.keyValue({
    'Assigned Tasks': agent.assigned_tasks?.toString() ?? '0',
    'Completed Tasks': agent.completed_tasks?.toString() ?? '0',
    'Failed Tasks': agent.failed_tasks?.toString() ?? '0'
  });
};

/**
 * Displays agent instructions section.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayInstructions = (agent: IAgent, cliOutput: CliOutputService): void => {
  cliOutput.section('Instructions');
  cliOutput.info(agent.instructions);
};

/**
 * Displays all agent sections.
 * @param agent - Agent to display.
 * @param cliOutput - CLI output service.
 */
const displayAllAgentSections = (agent: IAgent, cliOutput: CliOutputService): void => {
  displayBasicInfo(agent, cliOutput);
  displayInstructions(agent, cliOutput);
  displayCapabilities(agent, cliOutput);
  displayTools(agent, cliOutput);
  displayConfiguration(agent, cliOutput);
  displayMetrics(agent, cliOutput);
};

/**
 * Displays agent details in a formatted way.
 * @param agent - Agent to display.
 */
export const displayAgentDetails = (agent: IAgent): void => {
  const cliOutput = CliOutputService.getInstance();
  displayAllAgentSections(agent, cliOutput);
};

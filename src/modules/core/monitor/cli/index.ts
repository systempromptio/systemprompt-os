/**
 * CLI commands index for monitor module.
 */

import type { Command } from 'commander';
import { createStatusCommand } from '@/modules/core/monitor/cli/status.js';
import { createMetricsCommand } from '@/modules/core/monitor/cli/metrics.js';
import { createAlertsCommand } from '@/modules/core/monitor/cli/alerts.js';

/**
 * Get all CLI commands for the monitor module.
 * @returns Array of configured Commander commands.
 */
export const getCommands = (): Command[] => {
  return [
    createStatusCommand(),
    createMetricsCommand(),
    createAlertsCommand()
  ];
};

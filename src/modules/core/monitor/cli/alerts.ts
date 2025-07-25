/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Monitor alerts CLI command.
 */

import { Command } from 'commander';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service.js';

const ERROR_EXIT_CODE = 1;
const NO_ALERTS = 0;

/**
 * Creates a command for managing alerts.
 * @returns The configured Commander command.
 */
export const createAlertsCommand = (): Command => {
  return new Command('monitor:alerts')
    .description('Manage monitoring alerts')
    .option('-l, --list', 'List all alerts')
    .action(async (options): Promise<void> => {
      try {
        const service = MonitorService.getInstance();
        await service.initialize();

        if (options.list) {
          const alerts = await service.getAlerts();

          if (alerts.length === NO_ALERTS) {
            console.log('No alerts configured.');
            return;
          }

          console.log('Monitor Alerts:');
          alerts.forEach((alert): void => {
            const status = alert.enabled ? 'enabled' : 'disabled';
            console.log(`- ${alert.name} (${alert.severity}, ${status})`);
            console.log(`  Metric: ${alert.metricType}`);
            console.log(`  Condition: ${alert.comparison} ${alert.thresholdValue}`);
            if (alert.description) {
              console.log(`  Description: ${alert.description}`);
            }
          });
        } else {
          console.log('Use --list to view all alerts');
        }
      } catch (error) {
        console.error('Error managing alerts:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};

/* eslint-disable
  systemprompt-os/no-console-with-help,
  systemprompt-os/no-block-comments,
  systemprompt-os/enforce-constants-imports
*/
/**
 * Monitor metrics CLI command.
 */

import { Command } from 'commander';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service.js';
import { MetricTypeEnum } from '@/modules/core/monitor/types/index.js';

const ERROR_EXIT_CODE = 1;
const DEFAULT_LIMIT = 10;
const NO_METRICS = 0;

/**
 * Creates a command for displaying metrics.
 * @returns The configured Commander command.
 */
export const createMetricsCommand = (): Command => {
  return new Command('monitor:metrics')
    .description('Display system metrics')
    .option('-t, --type <type>', 'Metric type', 'all')
    .option('-l, --limit <number>', 'Number of metrics to display', String(DEFAULT_LIMIT))
    .action(async (options): Promise<void> => {
      try {
        const service = MonitorService.getInstance();
        await service.initialize();

        const type = options.type === 'all' ? undefined : options.type as MetricTypeEnum;
        const limit = parseInt(options.limit, 10);

        const metrics = await service.getMetrics(type, limit);

        if (metrics.length === NO_METRICS) {
          console.log('No metrics found.');
          return;
        }

        console.log('System Metrics:');
        metrics.forEach((metric): void => {
          const unit = metric.unit ? ` ${metric.unit}` : '';
          console.log(
            `- [${metric.metricType}] ${metric.metricName}: ${metric.metricValue}${unit} ` +
            `(${metric.recordedAt.toISOString()})`
          );
        });
      } catch (error) {
        console.error('Error getting metrics:', error);
        process.exit(ERROR_EXIT_CODE);
      }
    });
};
/**
 * Record metric CLI command.
 * @file Record metric CLI command.
 * @module modules/core/monitor/cli/record
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service';
import { MetricType } from '@/modules/core/monitor/types/manual';

export const command: ICLICommand = {
  description: 'Record a metric value',
  options: [
    {
      name: 'name',
      alias: 'n',
      type: 'string',
      required: true,
      description: 'Metric name',
    },
    {
      name: 'value',
      alias: 'v',
      type: 'number',
      required: true,
      description: 'Metric value',
    },
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Metric type (counter, gauge, histogram)',
      default: 'gauge',
    },
    {
      name: 'unit',
      alias: 'u',
      type: 'string',
      description: 'Metric unit (e.g., ms, bytes, requests)',
    },
  ],
  execute: async (context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();

    try {
      const {args} = context;
      const name = args.name as string;
      const value = args.value as number;
      const type = args.type as string;
      const unit = args.unit as string | undefined;

      const validTypes: MetricType[] = [MetricType.COUNTER, MetricType.GAUGE, MetricType.HISTOGRAM];
      const metricType = type as MetricType;
      if (!validTypes.includes(metricType)) {
        cliOutput.error(`Invalid metric type: ${type}. Must be one of: ${validTypes.join(', ')}`);
        process.exit(1);
        return;
      }

      const monitorService = MonitorService.getInstance();
      monitorService.initialize();

      const recordOptions = {
        name,
        value,
        type: metricType,
        ...unit && { unit }
      };
      monitorService.recordMetric(recordOptions);

      await monitorService.shutdown();

      const unitDisplay = unit ? ` ${unit}` : '';
      cliOutput.success(`Metric recorded: ${name} = ${String(value)} (${type})${unitDisplay}`);

      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error recording metric: ${errorMessage}`);
      process.exit(1);
    }
  },
};

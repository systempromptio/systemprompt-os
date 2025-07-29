/**
 * Record metric CLI command.
 * @file Record metric CLI command.
 * @module modules/core/monitor/cli/record
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { MetricService } from '@/modules/core/monitor/services/metric.service';
import { MetricType } from '@/modules/core/monitor/types';

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
      const {
 name, value, type, unit
} = context.options as {
        name: string;
        value: number;
        type: string;
        unit?: string;
      };

      const validTypes: MetricType[] = [MetricType.COUNTER, MetricType.GAUGE, MetricType.HISTOGRAM];
      if (!validTypes.includes(type as MetricType)) {
        cliOutput.error(`Invalid metric type: ${type}. Must be one of: ${validTypes.join(', ')}`);
        process.exit(1);
        return;
      }

      const metricService = MetricService.getInstance();

      metricService.recordMetric({
        name,
        value,
        type: type as MetricType,
        ...unit && { unit },
      });

      cliOutput.success(`Metric recorded: ${name} = ${value} (${type})${unit ? ` ${unit}` : ''}`);

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error recording metric');
      process.exit(1);
    }
  },
};

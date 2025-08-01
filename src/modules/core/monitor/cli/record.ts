/**
 * Record metric CLI command.
 * @file Record metric CLI command.
 * @module modules/core/monitor/cli/record
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service';
import { MetricType } from '@/modules/core/monitor/types/database.generated';

/**
 * Validate string argument.
 * @param value - Value to validate.
 * @param name - Argument name for error messages.
 * @returns Validated string.
 * @throws Error if value is not a valid string.
 */
const validateStringArg = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${name}: must be a non-empty string`);
  }
  return value;
};

/**
 * Validate number argument.
 * @param value - Value to validate.
 * @param name - Argument name for error messages.
 * @returns Validated number.
 * @throws Error if value is not a valid number.
 */
const validateNumberArg = (value: unknown, name: string): number => {
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (isNaN(parsed)) {
      throw new Error(`Invalid ${name}: must be a valid number`);
    }
    return parsed;
  }
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`Invalid ${name}: must be a valid number`);
  }
  return value;
};

/**
 * Validate and convert metric type.
 * @param type - Type string to validate.
 * @returns Valid metric type.
 * @throws Error if type is not valid.
 */
const validateMetricType = (type: string): MetricType => {
  const validTypes: MetricType[] = [MetricType.COUNTER, MetricType.GAUGE, MetricType.HISTOGRAM];

  if (!validTypes.some((validType): boolean => {
    return validType.toString() === type;
  })) {
    throw new Error(`Invalid metric type: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }

  return validTypes.find((validType): boolean => {
    return validType.toString() === type;
  }) ?? MetricType.GAUGE;
};

/**
 * Process metric recording with proper validation.
 * @param context - CLI context with arguments.
 * @returns Promise resolving to success message.
 * @throws Error if validation fails.
 */
const processMetricRecording = async (context: ICLIContext): Promise<{ message: string }> => {
  const { args } = context;

  const name = validateStringArg(args.name, 'name');
  const value = validateNumberArg(args.value, 'value');
  const type = validateStringArg(args.type, 'type');
  const unit = typeof args.unit === 'string' && args.unit.length > 0
    ? validateStringArg(args.unit, 'unit') : undefined;

  const metricType = validateMetricType(type);
  const monitorService = MonitorService.getInstance();

  const recordOptions = {
    name,
    value,
    type: metricType,
    ...unit !== undefined && { unit }
  };

  monitorService.recordMetric(recordOptions);
  await monitorService.shutdown();

  const unitDisplay = unit !== undefined && unit.length > 0 ? ` ${unit}` : '';
  return { message: `Metric recorded: ${name} = ${String(value)} (${type})${unitDisplay}` };
};

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
      const result = await processMetricRecording(context);
      cliOutput.success(result.message);
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cliOutput.error(`Error recording metric: ${errorMessage}`);
      process.exit(1);
    }
  },
};

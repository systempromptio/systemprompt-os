/**
 * List metrics CLI command.
 * @file List metrics CLI command.
 * @module modules/core/monitor/cli/list
 */

import type { ICLICommand } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { MonitorService } from '@/modules/core/monitor/services/monitor.service';

export const command: ICLICommand = {
  description: 'List available metrics',

  execute: async (): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();

    try {
      const monitorService = MonitorService.getInstance();
      const metricNames = await monitorService.getMetricNames();

      cliOutput.section('Available Metrics');

      if (metricNames.length === 0) {
        cliOutput.info('No metrics recorded yet.');
        process.exit(0);
        return;
      }

      const metricData = await Promise.all(
        metricNames.map(async (name: string): Promise<{name: string; count: string}> => {
          const results = await monitorService.queryMetrics({ metric: name });
          return {
            name,
            count: results.data.length.toString()
          };
        })
      );

      cliOutput.table(metricData, [
        {
 key: 'name',
header: 'Metric Name'
},
        {
 key: 'count',
header: 'Count'
}
      ]);

      process.exit(0);
    } catch (_error) {
      cliOutput.error('Error listing metrics');
      process.exit(1);
    }
  },
};

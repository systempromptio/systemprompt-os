/**
 * List metrics CLI command.
 * @file List metrics CLI command.
 * @module modules/core/monitor/cli/list
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { MetricService } from '@/modules/core/monitor/services/metric.service';
import { DatabaseService } from '@/modules/core/database/services/database.service';

export const command: ICLICommand = {
  description: 'List available metrics',
  execute: async (_context: ICLIContext): Promise<void> => {
    const cliOutput = CliOutputService.getInstance();

    try {
      const db = DatabaseService.getInstance();

      const tables = await db.query(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='metric'
      `);

      if (tables.length === 0) {
        cliOutput.info('No metrics recorded yet. Metric table not initialized.');
        process.exit(0);
        return;
      }

      const metricService = MetricService.getInstance();
      const metricNames = await metricService.getMetricNames();

      cliOutput.section('Available Metrics');

      if (metricNames.length === 0) {
        cliOutput.info('No metrics recorded yet.');
      } else {
        const rows = await Promise.all(
          metricNames.map(async (name) => {
            const countResult = await db.query(
              'SELECT COUNT(*) as count FROM metric WHERE name = ?',
              [name]
            );
            return {
              name,
              count: ((countResult as any)[0] as { count: number }).count.toString()
            };
          })
        );

        cliOutput.table(rows, [
          {
 key: 'name',
header: 'Metric Name'
},
          {
 key: 'count',
header: 'Count'
}
        ]);
      }

      const recentMetrics = await db.query(`
        SELECT name, type, value, timestamp 
        FROM metric 
        ORDER BY timestamp DESC 
        LIMIT 10
      `);

      if (recentMetrics.length > 0) {
        cliOutput.section('Recent Metrics (Last 10)');
        const rows = recentMetrics.map((m: unknown) => { return {
          name: (m as any).name,
          type: (m as any).type,
          value: (m as any).value.toString(),
          timestamp: new Date((m as any).timestamp).toLocaleString()
        } });

        cliOutput.table(rows, [
          {
 key: 'name',
header: 'Name'
},
          {
 key: 'type',
header: 'Type'
},
          {
 key: 'value',
header: 'Value'
},
          {
 key: 'timestamp',
header: 'Timestamp'
}
        ]);
      }

      process.exit(0);
    } catch (error) {
      cliOutput.error('Error listing metrics');
      process.exit(1);
    }
  },
};

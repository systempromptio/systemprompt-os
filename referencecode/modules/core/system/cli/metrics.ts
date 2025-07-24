/**
 * System metrics command
 */

import { Container } from 'typedi';
import type { CLIContext } from '@/modules/types.js';
import { SystemModule } from '../index.js';
import { formatPercent, formatTimestamp } from '../utils/format.js';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      // Get system module from container
      const systemModule = Container.get(SystemModule);
      await systemModule.initialize();

      const period = typeof context.args['period'] === 'string' ? context.args['period'] : '1h';
      const type = typeof context.args['type'] === 'string' ? context.args['type'] : 'all';

      console.log(`System Metrics (${period})`);
      console.log('======================\n');

      // Get metrics
      const metrics = await systemModule.getMetrics(period);

      if (metrics.length === 0) {
        console.log('No metrics available for this period.');
        return;
      }

      // Group metrics by type
      const metricsByName = new Map<string, any[]>();

      metrics.forEach((m) => {
        if (!metricsByName.has(m.name)) {
          metricsByName.set(m.name, []);
        }
        metricsByName.get(m.name)!.push(m);
      });

      // Display metrics based on type
      const displayTypes = type === 'all' ? ['cpu', 'memory', 'disk'] : [type];

      for (const metricType of displayTypes) {
        const metricName = `system.${metricType}.usage`;
        const typeMetrics = metricsByName.get(metricName);

        if (!typeMetrics || typeMetrics.length === 0) {
          continue;
        }

        // Calculate statistics
        const values = typeMetrics.map((m) => m.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const latest = values[values.length - 1];

        console.log(`${metricType.toUpperCase()} Usage:`);
        console.log(`  Current: ${formatPercent(latest)}`);
        console.log(`  Average: ${formatPercent(avg)}`);
        console.log(`  Min:     ${formatPercent(min)}`);
        console.log(`  Max:     ${formatPercent(max)}`);
        console.log('');

        // Show trend (last 10 points)
        if (typeMetrics.length > 1) {
          console.log('  Recent trend:');
          const recent = typeMetrics.slice(-10);
          recent.forEach((m) => {
            const time = formatTimestamp(new Date(m.timestamp));
            const bar = '█'.repeat(Math.round(m.value / 10));
            console.log(`  ${time} ${bar} ${formatPercent(m.value)}`);
          });
          console.log('');
        }
      }

      // Show uptime metric
      const uptimeMetrics = metricsByName.get('system.uptime');
      if (uptimeMetrics && uptimeMetrics.length > 0) {
        const latest = uptimeMetrics[uptimeMetrics.length - 1];
        const { formatDuration } = import('../utils/format.js');
        console.log(`System Uptime: ${formatDuration(latest.value)}`);
      }
    } catch (error) {
      console.error('Error getting metrics:', error);
      process.exit(1);
    }
  },
};

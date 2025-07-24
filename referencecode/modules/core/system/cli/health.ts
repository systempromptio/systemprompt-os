/**
 * System health check command
 */

import { Container } from 'typedi';
import type { CLIContext } from '@/modules/types.js';
import { SystemModule } from '../index.js';
import { writeFileSync } from 'fs';

export const command = {
  async execute(context: CLIContext): Promise<void> {
    try {
      // Get system module from container
      const systemModule = Container.get(SystemModule);
      await systemModule.initialize();

      console.log('Running system health check...\n');

      // Get health report
      const report = await systemModule.getHealthReport();

      // Display results
      const statusIcon = {
        pass: '✓',
        warn: '⚠',
        fail: '✗',
      };

      const statusColor = {
        pass: '\x1b[32m', // Green
        warn: '\x1b[33m', // Yellow
        fail: '\x1b[31m', // Red
      };
      const reset = '\x1b[0m';

      console.log(`Overall Health: ${report.overall.toUpperCase()}\n`);

      console.log('Health Checks:');
      console.log('--------------');

      for (const check of report.checks) {
        const icon = statusIcon[check.status];
        const color = statusColor[check.status];
        console.log(`${color}${icon}${reset} ${check.name}: ${check.message}`);

        if (check.details && context.args['detailed']) {
          console.log(
            `  Details: ${JSON.stringify(check.details, null, 2).split('\n').join('\n  ')}`,
          );
        }
      }

      // Save report if requested
      if (context.args['report'] && typeof context.args['report'] === 'string') {
        const reportData = {
          ...report,
          timestamp: new Date().toISOString(),
          system: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        };

        writeFileSync(context.args['report'], JSON.stringify(reportData, null, 2));
        console.log(`\nHealth report saved to: ${context.args['report']}`);
      }

      // Attempt fixes if requested
      if (context.args['fix'] && report.overall !== 'healthy') {
        console.log('\nAttempting to fix issues...');

        for (const check of report.checks) {
          if (check.status === 'fail') {
            switch (check.name) {
              case 'disk':
                console.log('- Creating missing directories...');
                {
                  const { mkdirSync } = import('fs');
                }
                mkdirSync('./state', { recursive: true });
                break;

              case 'modules':
                console.log('- Module issues require manual intervention');
                break;

              default:
                console.log(`- Cannot auto-fix ${check.name} issues`);
            }
          }
        }

        // Re-run health check
        console.log('\nRe-running health check...');
        const newReport = await systemModule.getHealthReport();
        console.log(`New health status: ${newReport.overall.toUpperCase()}`);
      }

      // Exit with appropriate code
      if (report.overall === 'unhealthy') {
        process.exit(2);
      } else if (report.overall === 'degraded') {
        process.exit(1);
      }
    } catch (error) {
      console.error('Error running health check:', error);
      process.exit(3);
    }
  },
};

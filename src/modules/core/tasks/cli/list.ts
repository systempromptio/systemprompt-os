/**
 * Tasks module list CLI command.
 * @file Tasks module list CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand } from '@/modules/core/cli/types/index';
import { TaskStatus } from '@/modules/core/tasks/types/index';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ErrorReport {
  id: string;
  path: string;
  errors: number;
  type: 'lint' | 'typecheck';
  timestamp: string;
}

/**
 * Tasks list command.
 */
export const list: CLICommand = {
  name: 'list',
  description: 'List tasks in the queue',
  options: [
    {
      name: 'status',
      alias: 's',
      type: 'string',
      description: 'Filter by task status',
      choices: Object.values(TaskStatus)
    },
    {
      name: 'limit',
      alias: 'l',
      type: 'number',
      description: 'Number of tasks to show',
      default: 10
    },
    {
      name: 'errors',
      alias: 'e',
      type: 'boolean',
      description: 'Show error reports instead of tasks',
      default: false
    }
  ],

  execute: async (options: any): Promise<void> => {
    const { limit = 10, errors: showErrors } = options.args || options;
    
    if (showErrors) {
      const reportsFile = join(process.cwd(), 'error-reports.json');
      
      if (!existsSync(reportsFile)) {
        process.stdout.write('\nNo error reports found. Run "npm run track-errors" to generate reports.\n');
        return;
      }
      
      try {
        const reports: ErrorReport[] = JSON.parse(readFileSync(reportsFile, 'utf8'));
        const sortedReports = reports
          .sort((a, b) => b.errors - a.errors)
          .slice(0, limit);
        
        process.stdout.write('\nError Reports (sorted by error count)\n');
        process.stdout.write('=====================================\n\n');
        
        if (sortedReports.length === 0) {
          process.stdout.write('No error reports found.\n');
          return;
        }
        
        sortedReports.forEach((report, index) => {
          const date = new Date(report.timestamp).toLocaleString();
          process.stdout.write(`${index + 1}. ${report.type.toUpperCase()} - ${report.errors} errors\n`);
          process.stdout.write(`   Path: ${report.path}\n`);
          process.stdout.write(`   Time: ${date}\n\n`);
        });
        
      } catch (error) {
        process.stderr.write(`Error reading reports: ${error}\n`);
        process.exit(1);
      }
    } else {
      process.stdout.write('\nTask Queue\n');
      process.stdout.write('==========\n\n');
      process.stdout.write('Tasks list command - placeholder implementation\n');
      process.stdout.write('The actual implementation would list tasks in the queue\n');
      process.stdout.write('\nTip: Use --errors flag to show error reports\n');
    }
  }
};

export default list;

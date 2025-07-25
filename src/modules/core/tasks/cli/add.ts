/**
 * Tasks module add CLI command.
 * @file Tasks module add CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand } from '@/modules/core/cli/types/index';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ErrorReport {
  id: string;
  path: string;
  errors: number;
  type: 'lint' | 'typecheck';
  timestamp: string;
}

/**
 * Tasks add command.
 */
export const add: CLICommand = {
  name: 'add',
  description: 'Add a new task to the queue',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Task type',
      required: true
    },
    {
      name: 'payload',
      alias: 'p',
      type: 'string',
      description: 'Task payload (JSON format)'
    },
    {
      name: 'priority',
      alias: 'r',
      type: 'number',
      description: 'Task priority (higher = more important)',
      default: 0
    }
  ],

  execute: async (options: any): Promise<void> => {
    const { type, payload } = options.args || options;
    
    if (type === 'lint' || type === 'typecheck') {
      try {
        const data = JSON.parse(payload || '{}');
        const report: ErrorReport = {
          id: Date.now().toString(),
          path: data.path || process.cwd(),
          errors: data.errors || 0,
          type: data.type || type,
          timestamp: new Date().toISOString()
        };

        const reportsFile = join(process.cwd(), 'error-reports.json');
        let reports: ErrorReport[] = [];
        
        if (existsSync(reportsFile)) {
          reports = JSON.parse(readFileSync(reportsFile, 'utf8'));
        }
        
        reports.push(report);
        writeFileSync(reportsFile, JSON.stringify(reports, null, 2));
        
        process.stdout.write(`Added ${type} report: ${report.errors} errors found in ${report.path}\n`);
      } catch (error) {
        process.stderr.write(`Error processing report: ${error}\n`);
        process.exit(1);
      }
    } else {
      process.stdout.write('\nAdding task to queue...\n');
      process.stdout.write('Tasks add command - placeholder implementation\n');
      process.stdout.write('The actual implementation would add a task to the queue\n');
    }
  }
};

export default add;

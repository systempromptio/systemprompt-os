/**
 * Tasks module delete CLI command.
 * @file Tasks module delete CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand } from '@/modules/core/cli/types/index';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ErrorReport {
  id: string;
  path: string;
  errors: number;
  type: 'lint' | 'typecheck';
  timestamp: string;
}

/**
 * Tasks delete command.
 */
export const delete_cmd: CLICommand = {
  name: 'delete',
  description: 'Delete tasks by type',
  options: [
    {
      name: 'type',
      alias: 't',
      type: 'string',
      description: 'Task type to delete (lint, typecheck, or all)',
      required: true
    }
  ],

  execute: async (options: any): Promise<void> => {
    const { type } = options.args || options;
    
    if (type === 'lint' || type === 'typecheck' || type === 'all') {
      const reportsFile = join(process.cwd(), 'error-reports.json');
      
      if (!existsSync(reportsFile)) {
        process.stdout.write(`No error reports found to delete.\n`);
        return;
      }
      
      try {
        const reports: ErrorReport[] = JSON.parse(readFileSync(reportsFile, 'utf8'));
        let filteredReports: ErrorReport[];
        let deletedCount = 0;
        
        if (type === 'all') {
          deletedCount = reports.length;
          filteredReports = [];
        } else {
          const originalLength = reports.length;
          filteredReports = reports.filter(report => report.type !== type);
          deletedCount = originalLength - filteredReports.length;
        }
        
        writeFileSync(reportsFile, JSON.stringify(filteredReports, null, 2));
        
        process.stdout.write(`Deleted ${deletedCount} ${type === 'all' ? '' : type + ' '}error reports\n`);
      } catch (error) {
        process.stderr.write(`Error deleting reports: ${error}\n`);
        process.exit(1);
      }
    } else {
      process.stdout.write('\nDeleting tasks...\n');
      process.stdout.write('Tasks delete command - placeholder implementation\n');
      process.stdout.write('The actual implementation would delete tasks from the queue\n');
    }
  }
};

export default delete_cmd;
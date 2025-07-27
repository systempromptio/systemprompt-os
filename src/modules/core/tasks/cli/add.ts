/**
 * Tasks module add CLI command.
 * @file Tasks module add CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import type { IErrorReport } from '@/modules/core/tasks/types/index';
import {
 existsSync, readFileSync, writeFileSync
} from 'fs';
import { join } from 'path';

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

  execute: async (options: CLIContext): Promise<void> => {
    await Promise.resolve().then(() => {
    const type = options.args.type as string | undefined;
    const payload = options.args.payload as string | undefined;

    if (type === 'lint' || type === 'typecheck') {
      try {
        const parsedPayload = JSON.parse(payload ?? '{}') as Record<string, unknown>;
        const report: IErrorReport = {
          id: Date.now().toString(),
          path: (parsedPayload.path as string | undefined) ?? process.cwd(),
          errors: (parsedPayload.errors as number | undefined) ?? 0,
          type: (parsedPayload.type as 'lint' | 'typecheck' | undefined) ?? type,
          timestamp: new Date().toISOString()
        };

        const reportsFile = join(process.cwd(), 'error-reports.json');
        let reports: IErrorReport[] = [];

        if (existsSync(reportsFile)) {
          reports = JSON.parse(readFileSync(reportsFile, 'utf8')) as IErrorReport[];
        }

        reports.push(report);
        writeFileSync(reportsFile, JSON.stringify(reports, null, 2));

        process.stdout.write(
          `Added ${type} report: ${String(report.errors)} errors found in ${report.path}\n`
        );
      } catch (error) {
        process.stderr.write(`Error processing report: ${String(error)}\n`);
        process.exit(1);
      }
    } else {
      process.stdout.write('\nAdding task to queue...\n');
      process.stdout.write('Tasks add command - placeholder implementation\n');
      process.stdout.write('The actual implementation would add a task to the queue\n');
    }
    });
  }
};

export default add;

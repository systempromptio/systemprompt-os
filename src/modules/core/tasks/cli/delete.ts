/**
 * Tasks module delete CLI command.
 * @file Tasks module delete CLI command.
 * @module modules/core/tasks/cli
 */

import type { CLICommand, CLIContext } from '@/modules/core/cli/types/index';
import type { IErrorReport } from '@/modules/core/tasks/types/index';
import {
  existsSync,
  readFileSync,
  writeFileSync
} from 'fs';
import { join } from 'path';

/**
 * Read error reports from file.
 * @param reportsFile - Path to reports file.
 * @returns Array of error reports.
 */
const readErrorReports = (reportsFile: string): IErrorReport[] => {
  try {
    const fileContent = readFileSync(reportsFile, 'utf8');
    const parsed: IErrorReport[] = JSON.parse(fileContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Filter reports based on deletion type.
 * @param reports - Array of error reports.
 * @param type - Type to delete.
 * @returns Object with filtered reports and delete count.
 */
const filterReports = (reports: IErrorReport[], type: string): {
  filteredReports: IErrorReport[];
  deletedCount: number;
} => {
  if (type === 'all') {
    return {
      filteredReports: [],
      deletedCount: reports.length
    };
  }

  const filteredReports = reports.filter((report): boolean => {
    return report.type !== type;
  });
  const deletedCount = reports.length - filteredReports.length;

  return {
    filteredReports,
    deletedCount
  };
};

/**
 * Write filtered reports back to file.
 * @param reportsFile - Path to reports file.
 * @param filteredReports - Filtered array of reports.
 */
const writeErrorReports = (reportsFile: string, filteredReports: IErrorReport[]): void => {
  writeFileSync(reportsFile, JSON.stringify(filteredReports, null, 2));
};

/**
 * Delete error reports by type.
 * @param type - Type of reports to delete.
 */
const deleteErrorReports = (type: string): void => {
  const reportsFile = join(process.cwd(), 'error-reports.json');

  if (!existsSync(reportsFile)) {
    process.stdout.write('No error reports found to delete.\n');
    return;
  }

  try {
    const reports = readErrorReports(reportsFile);
    const { filteredReports, deletedCount } = filterReports(reports, type);

    writeErrorReports(reportsFile, filteredReports);
    const typePrefix = type === 'all' ? '' : `${type} `;
    const message = `Deleted ${String(deletedCount)} ${typePrefix}error reports\n`;
    process.stdout.write(message);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error deleting reports: ${errorMessage}\n`);
    process.exit(1);
  }
};

/**
 * Display placeholder message for actual task deletion.
 */
const displayTaskDeletionPlaceholder = (): void => {
  process.stdout.write('\nDeleting tasks...\n');
  process.stdout.write('Tasks delete command - placeholder implementation\n');
  process.stdout.write('The actual implementation would delete tasks from the queue\n');
};

/**
 * Execute delete command.
 * @param options - CLI context options.
 */
const executeDelete = (options: CLIContext): void => {
  const { args } = options;
  const { type } = args;

  if (typeof type !== 'string') {
    process.stderr.write('Error: Type parameter is required\n');
    process.exit(1);
  }

  if (type === 'lint' || type === 'typecheck' || type === 'all') {
    deleteErrorReports(type);
  } else {
    displayTaskDeletionPlaceholder();
  }
};

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
  execute: executeDelete
};

export default delete_cmd;

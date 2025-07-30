/**
 * Lint command - runs ESLint and displays formatted summary.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { LintService } from '@/modules/core/dev/services/lint.service';
import type { LintResult } from '@/modules/core/dev/services/lint.service';

/**
 * Display lint results in a formatted table.
 * @param result - Lint results from LintService.
 * @param args - CLI arguments for display options.
 * @param cliOutput - CLI output service.
 */
const displayLintResults = (
  result: LintResult,
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  if (result.success && result.totalErrors === 0 && result.totalWarnings === 0) {
    cliOutput.success('✅ No lint issues found! Code looks clean.');
    return;
  }

  const maxValue = typeof args.max === 'string' || typeof args.max === 'number'
    ? args.max
    : '10';
  const maxDisplay = parseInt(String(maxValue), 10);

  if (result.totalErrors > 0) {
    cliOutput.error(`❌ Found ${result.totalErrors} errors and ${result.totalWarnings} warnings in ${result.totalFiles} files`);
  } else {
    cliOutput.warning(`⚠️ Found ${result.totalWarnings} warnings in ${result.totalFiles} files`);
  }

  if (result.results.length === 0) {
    return;
  }

  cliOutput.output('', { format: 'text' });
  cliOutput.output(
    'File Path                                                    | Errors | Warnings',
    { format: 'text' }
  );
  cliOutput.output(
    '-------------------------------------------------------------|--------|----------',
    { format: 'text' }
  );

  const displayResults = result.results.slice(0, maxDisplay);
  for (const fileResult of displayResults) {
    const pathDisplay = fileResult.filePath.padEnd(60, ' ').substring(0, 60);
    const errorCount = String(fileResult.errorCount).padStart(6, ' ');
    const warningCount = String(fileResult.warningCount).padStart(8, ' ');
    cliOutput.output(`${pathDisplay} | ${errorCount} | ${warningCount}`, { format: 'text' });
  }

  if (result.results.length > maxDisplay) {
    cliOutput.output('', { format: 'text' });
    cliOutput.output(
      `... and ${String(result.results.length - maxDisplay)} more files with issues`,
      { format: 'text' }
    );
  }

  cliOutput.output('', { format: 'text' });
  cliOutput.output(`Total: ${result.totalErrors} errors, ${result.totalWarnings} warnings`, { format: 'text' });
};

/**
 * Execute lint check command.
 * @param context - CLI context.
 */
const executeLintCheck = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    cliOutput.info('🔍 Running ESLint analysis...');
    cliOutput.output('', { format: 'text' });

    const lintService = LintService.getInstance();
    lintService.initialize();

    const result = await lintService.runLint();
    displayLintResults(result, args, cliOutput);

    if (!result.success && result.totalErrors > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(
      LogSource.CLI,
      `Error running lint check: ${error instanceof Error ? error.message : String(error)}`
    );
    cliOutput.error(`Error running lint check: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export const command: ICLICommand = {
  description: 'Run linter and display a formatted summary of issues',
  options: [
    {
      name: 'max',
      alias: 'm',
      type: 'string',
      description: 'Maximum number of files to display',
      default: '10'
    }
  ],
  execute: executeLintCheck
};

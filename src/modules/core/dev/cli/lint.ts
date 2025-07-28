/**
 * Lint command - analyzes code for common issues.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import * as fs from 'fs';
import { glob } from 'glob';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { DevSessionStatus, DevSessionType } from '@/modules/core/dev/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { LintError } from '@/modules/core/dev/types/lint.types';

/**
 * Common lint patterns to check.
 */
const LINT_PATTERNS = [
  {
    pattern: /console\.(?:log|warn|error|info|debug)/u,
    message: 'Use cliOutput instead of console methods'
  },
  {
    pattern: /\/\/\s*eslint-disable/u,
    message: 'Avoid disabling eslint rules'
  },
  {
    pattern: /any\s*;/u,
    message: 'Avoid using "any" type'
  },
  {
    pattern: /require\(/u,
    message: 'Use ES6 imports instead of require'
  },
  {
    pattern: /var\s+\w+/u,
    message: 'Use const or let instead of var'
  },
  {
    pattern: /==(?!=)/u,
    message: 'Use === instead of =='
  },
  {
    pattern: /!=(?!=)/u,
    message: 'Use !== instead of !='
  }
];

/**
 * Analyze a single file for lint issues.
 * @param filePath - Path to the file.
 * @returns Array of lint issues found.
 */
const analyzeFile = async (filePath: string): Promise<string[]> => {
  const issues: string[] = [];

  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index): void => {
      for (const { pattern, message } of LINT_PATTERNS) {
        if (pattern.test(line)) {
          issues.push(`Line ${String(index + 1)}: ${message}`);
        }
      }
    });
  } catch {
  }

  return issues;
};

/**
 * Display table header for lint results.
 * @param cliOutput - CLI output service.
 */
const displayLintTableHeader = (cliOutput: CliOutputService): void => {
  cliOutput.output('', { format: 'text' });
  cliOutput.output(
    'File Path                                                    | Errors',
    { format: 'text' }
  );
  cliOutput.output(
    '-------------------------------------------------------------|-------',
    { format: 'text' }
  );
};

/**
 * Display lint error rows.
 * @param displayErrors - Errors to display.
 * @param cliOutput - CLI output service.
 */
const displayLintErrorRows = (displayErrors: LintError[], cliOutput: CliOutputService): void => {
  for (const error of displayErrors) {
    const pathDisplay = error.path.padEnd(60, ' ').substring(0, 60);
    const errorCount = String(error.errors).padStart(6, ' ');
    cliOutput.output(`${pathDisplay} | ${errorCount}`, { format: 'text' });
  }
};

/**
 * Display summary for lint results.
 * @param lintErrors - All lint errors.
 * @param maxDisplay - Maximum errors displayed.
 * @param cliOutput - CLI output service.
 */
const displayLintSummary = (
  lintErrors: LintError[],
  maxDisplay: number,
  cliOutput: CliOutputService
): void => {
  if (lintErrors.length > maxDisplay) {
    cliOutput.output('', { format: 'text' });
    cliOutput.output(
      `... and ${String(lintErrors.length - maxDisplay)} more files`,
      { format: 'text' }
    );
  }

  const totalErrors = lintErrors.reduce((sum, errorItem): number => {
    return sum + errorItem.errors;
  }, 0);

  cliOutput.output('', { format: 'text' });
  cliOutput.output(`Total errors: ${String(totalErrors)}`, { format: 'text' });
};

/**
 * Display lint results.
 * @param lintErrors - Array of lint errors.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 */
const displayLintResults = (
  lintErrors: LintError[],
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  if (lintErrors.length === 0) {
    cliOutput.success('✅ No lint errors found!');
    return;
  }

  const maxValue = typeof args.max === 'string' || typeof args.max === 'number'
    ? args.max
    : '10';
  const maxDisplay = parseInt(String(maxValue), 10);
  const displayErrors = lintErrors.slice(0, maxDisplay);

  cliOutput.error(`❌ Found lint errors in ${String(lintErrors.length)} files:`);
  displayLintTableHeader(cliOutput);
  displayLintErrorRows(displayErrors, cliOutput);
  displayLintSummary(lintErrors, maxDisplay, cliOutput);
};

/**
 * Process lint files and return errors.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 * @returns Array of lint errors.
 */
const processLintFiles = async (
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): Promise<LintError[]> => {
  const files = await glob('src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.spec.ts', '**/*.test.ts'],
    cwd: process.cwd()
  });

  const fileAnalysisResults = await Promise.all(
    files.map(async (file): Promise<{ file: string; issues: string[] }> => {
      const issues = await analyzeFile(file);
      return {
        file,
        issues
      };
    })
  );

  const lintErrors: LintError[] = fileAnalysisResults
    .filter((result): boolean => {
      return result.issues.length > 0;
    })
    .map((result): LintError => {
      return {
        path: result.file,
        errors: result.issues.length,
        issues: result.issues
      };
    });

  lintErrors.sort((itemA, itemB): number => {
    return itemB.errors - itemA.errors;
  });
  displayLintResults(lintErrors, args, cliOutput);
  return lintErrors;
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
    const service = DevService.getInstance();
    service.setLogger(logger);
    await service.initialize();

    const session = await service.startSession(DevSessionType.LINT);
    cliOutput.info(`🔍 Starting lint check (session: ${String(session.id)})`);
    cliOutput.output('', { format: 'text' });

    await processLintFiles(args, cliOutput);
    await service.endSession(session.id, DevSessionStatus.COMPLETED);
  } catch (error) {
    logger.error(
      LogSource.CLI,
      `Error running lint check: ${error instanceof Error ? error.message : String(error)}`
    );
    cliOutput.error('Error running lint check');
    process.exit(1);
  }
};

export const command: ICLICommand = {
  description: 'Run code analysis and display a formatted summary of issues',
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

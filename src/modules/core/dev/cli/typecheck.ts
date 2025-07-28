/**
 * TypeScript check command - analyzes TypeScript code for type issues.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import * as fs from 'fs';
import { glob } from 'glob';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { DevSessionStatus, DevSessionType } from '@/modules/core/dev/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { TypeCheckError } from '@/modules/core/dev/types/typecheck.types';

/**
 * Common TypeScript patterns to check.
 */
const TYPE_PATTERNS = [
  {
    pattern: /:\s*any(?:\s|;|,|\)|$)/u,
    message: 'Avoid using "any" type'
  },
  {
    pattern: /\/\/\s*@ts-ignore/u,
    message: 'Avoid using @ts-ignore'
  },
  {
    pattern: /\/\/\s*@ts-nocheck/u,
    message: 'Avoid using @ts-nocheck'
  },
  {
    pattern: /as\s+any(?:\s|;|,|\)|$)/u,
    message: 'Avoid type assertion to "any"'
  },
  {
    pattern: /Function(?:\s|;|,|\)|$)/u,
    message: 'Use specific function type instead of Function'
  },
  {
    pattern: /Object(?:\s|;|,|\)|$)/u,
    message: 'Use specific object type instead of Object'
  },
  {
    pattern: /\[\s*\](?:\s|;|,|\)|$)/u,
    message: 'Specify array element type'
  }
];

/**
 * Check type patterns in a line.
 * @param line - Code line to check.
 * @param lineNumber - Line number for error reporting.
 * @returns Array of issues found.
 */
const checkTypePatterns = (line: string, lineNumber: number): string[] => {
  const issues: string[] = [];
  for (const { pattern, message } of TYPE_PATTERNS) {
    if (pattern.test(line)) {
      issues.push(`Line ${String(lineNumber)}: ${message}`);
    }
  }
  return issues;
};

/**
 * Check function return types in a line.
 * @param line - Code line to check.
 * @param lineNumber - Line number for error reporting.
 * @returns Array of issues found.
 */
const checkFunctionReturnTypes = (line: string, lineNumber: number): string[] => {
  const issues: string[] = [];
  if (line.includes('function') && !line.includes(':') && !line.includes('constructor')) {
    const functionMatch = line.match(/function\s+(?<functionName>\w+)\s*\(/u);
    if (functionMatch?.groups?.functionName !== undefined) {
      const { groups } = functionMatch;
      const { functionName } = groups;
      const nameText = functionName ?? 'unknown';
      const messageText = `Function "${nameText}" is missing return type`;
      const message = `Line ${String(lineNumber)}: ${messageText}`;
      issues.push(message);
    }
  }
  return issues;
};

/**
 * Check parameter type annotations in a line.
 * @param line - Code line to check.
 * @param lineNumber - Line number for error reporting.
 * @returns Array of issues found.
 */
const checkParameterTypes = (line: string, lineNumber: number): string[] => {
  const issues: string[] = [];
  const paramMatch = line.match(/\((?<params>[^)]+)\)/u);
  if (paramMatch?.groups?.params !== undefined) {
    const { groups } = paramMatch;
    const { params } = groups;
    if (params !== undefined) {
      const paramList = params.split(',');
      paramList.forEach((param): void => {
        const trimmedParam = param.trim();
        if (trimmedParam.length > 0 && !trimmedParam.includes(':')
            && (/\w+/u).test(trimmedParam) && !trimmedParam.includes('...')) {
          issues.push(`Line ${String(lineNumber)}: Parameter is missing type annotation`);
        }
      });
    }
  }
  return issues;
};

/**
 * Analyze a TypeScript file for type issues.
 * @param filePath - Path to the file.
 * @returns Array of type issues found.
 */
const analyzeTypeScriptFile = async (filePath: string): Promise<string[]> => {
  const issues: string[] = [];

  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index): void => {
      const lineNumber = index + 1;
      issues.push(...checkTypePatterns(line, lineNumber));
      issues.push(...checkFunctionReturnTypes(line, lineNumber));
      issues.push(...checkParameterTypes(line, lineNumber));
    });
  } catch {
    return [];
  }

  return issues;
}

/**
 * Display typecheck table header.
 * @param cliOutput - CLI output service.
 */
const displayTypeCheckHeader = (cliOutput: CliOutputService): void => {
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
 * Display typecheck summary.
 * @param typeErrors - Array of type errors.
 * @param maxDisplay - Max display count.
 * @param cliOutput - CLI output service.
 */
const displayTypeCheckSummary = (
  typeErrors: TypeCheckError[],
  maxDisplay: number,
  cliOutput: CliOutputService
): void => {
  if (typeErrors.length > maxDisplay) {
    cliOutput.output('', { format: 'text' });
    cliOutput.output(
      `... and ${String(typeErrors.length - maxDisplay)} more files`,
      { format: 'text' }
    );
  }

  cliOutput.output('', { format: 'text' });
  const totalErrors = typeErrors.reduce((sum, errorItem): number => {
    return sum + errorItem.errors;
  }, 0);
  cliOutput.output(`Total errors: ${String(totalErrors)}`, { format: 'text' });
};

/**
 * Display TypeScript check results.
 * @param typeErrors - Array of type errors.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 */
const displayTypeCheckResults = (
  typeErrors: TypeCheckError[],
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  if (typeErrors.length === 0) {
    cliOutput.success('✅ No TypeScript errors found!');
    return;
  }

  const maxArg = args.max ?? '10';
  const maxValue = typeof maxArg === 'string' ? maxArg : '10';
  const maxDisplay = parseInt(String(maxValue), 10);
  const displayErrors = typeErrors.slice(0, maxDisplay);

  cliOutput.error(`❌ Found TypeScript errors in ${String(typeErrors.length)} files:`);
  displayTypeCheckHeader(cliOutput);

  for (const errorItem of displayErrors) {
    const pathDisplay = errorItem.path.padEnd(60, ' ').substring(0, 60);
    const errorCount = String(errorItem.errors).padStart(6, ' ');
    cliOutput.output(`${pathDisplay} | ${errorCount}`, { format: 'text' });
  }

  displayTypeCheckSummary(typeErrors, maxDisplay, cliOutput);
}

/**
 * Process TypeScript files and get error results.
 * @param files - Array of file paths.
 * @returns Processed type errors.
 */
const processTypeScriptFiles = async (files: string[]): Promise<TypeCheckError[]> => {
  const fileAnalysisResults = await Promise.all(
    files.map(async (file): Promise<{ file: string; issues: string[] }> => {
      const issues = await analyzeTypeScriptFile(file);
      return {
        file,
        issues
      };
    })
  );

  const typeErrors: TypeCheckError[] = fileAnalysisResults
    .filter((result): boolean => {
      return result.issues.length > 0;
    })
    .map((result): TypeCheckError => {
      return {
        path: result.file,
        errors: result.issues.length,
        issues: result.issues
      };
    });

  typeErrors.sort((firstItem, secondItem): number => {
    return secondItem.errors - firstItem.errors;
  });

  return typeErrors;
};

/**
 * Initialize typecheck session.
 * @param logger - Logger service.
 * @param cliOutput - CLI output service.
 * @returns Session info.
 */
const initializeTypeCheckSession = async (
  logger: LoggerService,
  cliOutput: CliOutputService
): Promise<{ service: DevService; sessionId: number }> => {
  const service = DevService.getInstance();
  service.setLogger(logger);
  await service.initialize();

  const session = await service.startSession(DevSessionType.TYPECHECK);
  const sessionId = session.id;
  cliOutput.info(`🔍 Starting TypeScript check (session: ${sessionId})`);
  cliOutput.output('', { format: 'text' });

  return {
    service,
    sessionId
  };
};

/**
 * Execute TypeScript check command.
 * @param context - CLI context.
 */
const executeTypeCheck = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const { service, sessionId } = await initializeTypeCheckSession(logger, cliOutput);

    const files = await glob('src/**/*.{ts,tsx}', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
      cwd: process.cwd()
    });

    const typeErrors = await processTypeScriptFiles(files);
    displayTypeCheckResults(typeErrors, args, cliOutput);

    await service.endSession(sessionId, DevSessionStatus.COMPLETED);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(LogSource.CLI, `Error running TypeScript check: ${errorMessage}`);
    cliOutput.error('Error running TypeScript check');
    process.exit(1);
  }
}

export const command: ICLICommand = {
  description: 'Analyze TypeScript code and display a formatted summary of type errors',
  options: [
    {
      name: 'max',
      alias: 'm',
      type: 'string',
      description: 'Maximum number of files to display',
      default: '10'
    }
  ],
  execute: executeTypeCheck
};

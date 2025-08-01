/**
 * Typecheck command - runs TypeScript type checking and displays formatted summary.
 */

import { randomUUID } from 'crypto';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { TypecheckService } from '@/modules/core/dev/services/typecheck.service';
import type { TypecheckResult } from '@/modules/core/dev/services/typecheck.service';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { DevEvents } from '@/modules/core/events/types/manual';

/**
 * Display typecheck results in a formatted table.
 * @param result - Typecheck results from TypecheckService.
 * @param args - CLI arguments for display options.
 * @param cliOutput - CLI output service.
 */
const displayTypecheckResults = (
  result: TypecheckResult,
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  if (result.success && result.totalErrors === 0) {
    cliOutput.success('✅ No type errors found! Code is type-safe.');
    return;
  }

  const maxValue = typeof args.max === 'string' || typeof args.max === 'number'
    ? args.max
    : '10';
  const maxDisplay = parseInt(String(maxValue), 10);

  cliOutput.error(`❌ Found ${result.totalErrors} type errors in ${result.files.length} files`);

  if (result.files.length === 0) {
    return;
  }

  cliOutput.output('', { format: 'text' });
  cliOutput.output(
    'File Path                                                    | Line:Col | Code   | Message',
    { format: 'text' }
  );
  cliOutput.output(
    '-------------------------------------------------------------|----------|--------|------------------',
    { format: 'text' }
  );

  let displayedErrors = 0;
  const maxErrors = maxDisplay;

  for (const file of result.files) {
    if (displayedErrors >= maxErrors) {
      break;
    }

    for (const error of file.errors) {
      if (displayedErrors >= maxErrors) {
        break;
      }

      const pathDisplay = file.filePath.length > 60
        ? `...${file.filePath.substring(file.filePath.length - 57)}`
        : file.filePath.padEnd(60, ' ');
      const position = `${error.line}:${error.column}`.padEnd(8, ' ');
      const code = error.code.padEnd(6, ' ');
      const message = error.message.length > 50
        ? `${error.message.substring(0, 47)}...`
        : error.message;

      cliOutput.output(
        `${pathDisplay} | ${position} | ${code} | ${message}`,
        { format: 'text' }
      );
      displayedErrors++;
    }
  }

  const totalErrorCount = result.files.reduce((sum, file) => { return sum + file.errors.length }, 0);
  if (totalErrorCount > maxErrors) {
    cliOutput.output('', { format: 'text' });
    cliOutput.output(
      `... and ${totalErrorCount - maxErrors} more errors`,
      { format: 'text' }
    );
  }

  cliOutput.output('', { format: 'text' });
  cliOutput.output(`Total: ${result.totalErrors} type errors`, { format: 'text' });
};

/**
 * Execute typecheck command.
 * @param context - CLI context.
 */
const executeTypecheck = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();
  const startTime = Date.now();

  try {
    const module = args.module as string | undefined;
    let target = args.target as string | undefined;
    const strict = Boolean(args.strict);

    if (module && !target) {
      target = `src/modules/core/${module}`;
    }

    const targetInfo = module ? ` for ${module} module` : target ? ` for ${target}` : '';

    cliOutput.info(`🔍 Running TypeScript type checking${targetInfo}...`);
    cliOutput.output('', { format: 'text' });

    const typecheckService = TypecheckService.getInstance();
    typecheckService.initialize();

    const result = await typecheckService.runTypecheck(target, { strict });
    const duration = Date.now() - startTime;

    if (args.format === 'json') {
      const jsonResult = {
        module,
        target,
        strict,
        timestamp: new Date().toISOString(),
        duration,
        success: result.totalErrors === 0,
        totalErrors: result.totalErrors,
        files: result.files
      };
      cliOutput.json(jsonResult);
    } else {
      displayTypecheckResults(result, args, cliOutput);
    }

    const { ReportWriterService } = await import('@/modules/core/dev/services/report-writer.service');
    ReportWriterService.getInstance();

    const eventBus = EventBusService.getInstance();
    eventBus.emit(DevEvents.REPORT_WRITE_REQUEST, {
      requestId: randomUUID(),
      report: {
        timestamp: new Date().toISOString(),
        command: 'typecheck' as const,
        module,
        target,
        success: result.totalErrors === 0,
        duration,
        totalErrors: result.totalErrors,
        files: result.files.map(file => { return {
          filePath: file.filePath,
          errors: file.errors.map(error => { return {
            line: error.line,
            column: error.column,
            code: error.code,
            message: error.message
          } })
        } })
      }
    });

    if (result.totalErrors > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(
      LogSource.CLI,
      `Error running typecheck: ${error instanceof Error ? error.message : String(error)}`
    );
    cliOutput.error(`Error running typecheck: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export const command: ICLICommand = {
  description: 'Run TypeScript type checking and display errors',
  options: [
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Module name to typecheck (e.g., users, auth, logger)'
    },
    {
      name: 'target',
      alias: 't',
      type: 'string',
      description: 'Target file or folder to typecheck (e.g., src/modules/core/users)'
    },
    {
      name: 'strict',
      alias: 's',
      type: 'boolean',
      description: 'Enable strict type checking',
      default: false
    },
    {
      name: 'max',
      type: 'string',
      description: 'Maximum number of errors to display',
      default: '10'
    },
    {
      name: 'format',
      alias: 'f',
      type: 'string',
      description: 'Output format',
      choices: ['text', 'json'],
      default: 'text'
    }
  ],
  execute: executeTypecheck
};

/**
 * Unit test command - analyzes test coverage and test files.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import * as fs from 'fs';
import { glob } from 'glob';
import { DevService } from '@/modules/core/dev/services/dev.service';
import { DevSessionStatus, DevSessionType } from '@/modules/core/dev/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import type { TestFileInfo } from '@/modules/core/dev/types/test.types';

/**
 * Analyze test lines for counts.
 * @param lines - Array of file lines.
 * @returns Object with test counts.
 */
const analyzeTestLines = (lines: string[]): {
  tests: number;
  skipped: number;
  todos: number;
  coverage: string[];
} => {
  let tests = 0;
  let skipped = 0;
  let todos = 0;
  const coverage: string[] = [];

  lines.forEach((line): void => {
    if (line.match(/\b(?:it|test)\s*\(/u) !== null) {
      tests += 1;
    }

    if (
      line.match(/\b(?:it|test)\.skip\s*\(/u) !== null
      || line.match(/\bx(?:it|test)\s*\(/u) !== null
    ) {
      skipped += 1;
      tests -= 1;
    }

    if (line.match(/\b(?:it|test)\.todo\s*\(/u) !== null) {
      todos += 1;
    }

    if (line.match(/\bdescribe\s*\(/u) !== null) {
      const pattern = /describe\s*\(\s*['\"`](?<description>[^'\"`]+)['\"`]/u;
      const describeMatch = line.match(pattern);
      if (describeMatch?.groups?.description !== undefined) {
        coverage.push(describeMatch.groups.description);
      }
    }
  });

  return {
    tests,
    skipped,
    todos,
    coverage
  };
};

/**
 * Check for corresponding source file.
 * @param filePath - Test file path.
 * @param coverage - Coverage array to modify.
 */
const checkSourceFile = (filePath: string, coverage: string[]): void => {
  const sourceFile = filePath
    .replace(/\.(?<testType>spec|test)\.(?<extension>ts|tsx|js|jsx)$/u, '.$<extension>')
    .replace(/^tests?\//u, 'src/');

  if (!fs.existsSync(sourceFile) && coverage.length === 0) {
    coverage.push('⚠️ No corresponding source file found');
  }
};

/**
 * Analyze a test file.
 * @param filePath - Path to the test file.
 * @returns Test file information.
 */
const analyzeTestFile = async (filePath: string): Promise<Omit<TestFileInfo, 'path'>> => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const result = analyzeTestLines(lines);
    checkSourceFile(filePath, result.coverage);
    return result;
  } catch {
    return {
      tests: 0,
      skipped: 0,
      todos: 0,
      coverage: []
    };
  }
};

/**
 * Calculate test totals.
 * @param testInfos - Array of test file information.
 * @returns Object with test totals.
 */
const calculateTestTotals = (testInfos: TestFileInfo[]): {
  tests: number;
  skipped: number;
  todos: number;
} => {
  const totalTests = testInfos.reduce((sum, testItem): number => {
    return sum + testItem.tests;
  }, 0);
  const totalSkipped = testInfos.reduce((sum, testItem): number => {
    return sum + testItem.skipped;
  }, 0);
  const totalTodos = testInfos.reduce((sum, testItem): number => {
    return sum + testItem.todos;
  }, 0);

  return {
    tests: totalTests,
    skipped: totalSkipped,
    todos: totalTodos
  };
};

/**
 * Display test summary.
 * @param testInfos - Array of test file information.
 * @param totals - Test totals.
 * @param totals.tests - Total number of tests.
 * @param totals.skipped - Total number of skipped tests.
 * @param totals.todos - Total number of todo tests.
 * @param cliOutput - CLI output service.
 */
const displayTestSummary = (
  testInfos: TestFileInfo[],
  totals: { tests: number; skipped: number; todos: number },
  cliOutput: CliOutputService
): void => {
  cliOutput.success(
    `📊 Found ${String(testInfos.length)} test files with ${String(totals.tests)} tests`
  );
  if (totals.skipped > 0) {
    cliOutput.warning(`⚠️ ${String(totals.skipped)} skipped tests`);
  }
  if (totals.todos > 0) {
    cliOutput.info(`📝 ${String(totals.todos)} todo tests`);
  }
};

/**
 * Display test table.
 * @param displayTests - Tests to display.
 * @param cliOutput - CLI output service.
 */
const displayTestTable = (displayTests: TestFileInfo[], cliOutput: CliOutputService): void => {
  cliOutput.output('', { format: 'text' });
  const headerLine = 'Test File'
    + '                                                    | Tests | Skip | Todo';
  const separatorLine = '-------------------------------------------------------------'
    + '|-------|------|-----';
  cliOutput.output(headerLine, { format: 'text' });
  cliOutput.output(separatorLine, { format: 'text' });

  for (const testItem of displayTests) {
    const pathDisplay = testItem.path.padEnd(60, ' ').substring(0, 60);
    const testCount = testItem.tests.toString().padStart(5, ' ');
    const skipCount = testItem.skipped.toString().padStart(4, ' ');
    const todoCount = testItem.todos.toString().padStart(4, ' ');
    const line = `${pathDisplay} | ${String(testCount)} | `
      + `${String(skipCount)} | ${String(todoCount)}`;
    cliOutput.output(line, { format: 'text' });
  }
};

/**
 * Display more files notice and total summary.
 * @param params - Display parameters.
 * @param params.testInfos - Array of test file information.
 * @param params.maxDisplay - Maximum display count.
 * @param params.totals - Test totals.
 * @param params.totals.tests - Total number of tests.
 * @param params.totals.skipped - Total number of skipped tests.
 * @param params.totals.todos - Total number of todo tests.
 * @param params.cliOutput - CLI output service.
 */
const displayTestFooter = (params: {
  testInfos: TestFileInfo[];
  maxDisplay: number;
  totals: { tests: number; skipped: number; todos: number };
  cliOutput: CliOutputService;
}): void => {
  const {
    testInfos,
    maxDisplay,
    totals,
    cliOutput
  } = params;
  if (testInfos.length > maxDisplay) {
    cliOutput.output('', { format: 'text' });
    cliOutput.output(
      `... and ${String(testInfos.length - maxDisplay)} more files`,
      { format: 'text' }
    );
  }

  cliOutput.output('', { format: 'text' });
  const testsText = `${String(totals.tests)} tests`;
  const skippedText = `${String(totals.skipped)} skipped`;
  const todosText = `${String(totals.todos)} todos`;
  const summary = `Total: ${testsText}, ${skippedText}, ${todosText}`;
  cliOutput.output(summary, { format: 'text' });
};

/**
 * Display test results.
 * @param testInfos - Array of test file information.
 * @param args - CLI arguments.
 * @param cliOutput - CLI output service.
 */
const displayTestResults = (
  testInfos: TestFileInfo[],
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  if (testInfos.length === 0) {
    cliOutput.warning('⚠️ No test files found!');
    return;
  }

  const maxArg = args.max ?? '10';
  const maxValue = typeof maxArg === 'string' ? maxArg : '10';
  const maxStringValue = String(maxValue);
  const maxDisplay = parseInt(maxStringValue, 10);
  const displayTests = testInfos.slice(0, maxDisplay);
  const totals = calculateTestTotals(testInfos);

  displayTestSummary(testInfos, totals, cliOutput);
  displayTestTable(displayTests, cliOutput);
  displayTestFooter({
    testInfos,
    maxDisplay,
    totals,
    cliOutput
  });
};

/**
 * Process test files and analyze them.
 * @param testFiles - Array of test file paths.
 * @returns Processed test information.
 */
const processTestFiles = async (testFiles: string[]): Promise<TestFileInfo[]> => {
  const testAnalysisResults = await Promise.all(
    testFiles.map(async (file): Promise<{ file: string; info: Omit<TestFileInfo, 'path'> }> => {
      const info = await analyzeTestFile(file);
      return {
        file,
        info
      };
    })
  );

  const testInfos: TestFileInfo[] = testAnalysisResults
    .filter((result): boolean => {
      return result.info.tests > 0 || result.info.skipped > 0 || result.info.todos > 0;
    })
    .map((result): TestFileInfo => {
      return {
        path: result.file,
        ...result.info
      };
    });

  testInfos.sort((firstItem, secondItem): number => {
    return secondItem.tests - firstItem.tests;
  });

  return testInfos;
};

/**
 * Initialize dev service and start session.
 * @param logger - Logger service.
 * @param cliOutput - CLI output service.
 * @returns Session info.
 */
const initializeTestSession = async (
  logger: LoggerService,
  cliOutput: CliOutputService
): Promise<{ service: DevService; sessionId: number }> => {
  const service = DevService.getInstance();
  service.setLogger(logger);
  await service.initialize();

  const session = await service.startSession(DevSessionType.TEST);
  cliOutput.info(`🧪 Starting unit test analysis (session: ${String(session.id)})`);
  cliOutput.output('', { format: 'text' });

  return {
    service,
    sessionId: session.id
  };
};

/**
 * Execute unit test command.
 * @param context - CLI context.
 */
const executeUnitTest = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    const { service, sessionId } = await initializeTestSession(logger, cliOutput);

    const testFiles = await glob('**/*.{spec,test}.{ts,tsx,js,jsx}', {
      ignore: ['**/node_modules/**', '**/dist/**'],
      cwd: process.cwd()
    });

    const testInfos = await processTestFiles(testFiles);
    displayTestResults(testInfos, args, cliOutput);

    await service.endSession(sessionId, DevSessionStatus.COMPLETED);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(LogSource.CLI, `Error running unit test analysis: ${errorMessage}`);
    cliOutput.error('Error running unit test analysis');
    process.exit(1);
  }
}

export const command: ICLICommand = {
  description: 'Analyze test files and display a summary of test coverage',
  options: [
    {
      name: 'max',
      alias: 'm',
      type: 'string',
      description: 'Maximum number of files to display',
      default: '10'
    }
  ],
  execute: executeUnitTest
};

/**
 * Test command - runs integration tests and displays test coverage summary.
 */

import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/index';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/index';
import { TestService } from '@/modules/core/dev/services/test.service';
import type { TestResult } from '@/modules/core/dev/services/test.service';

/**
 * Display test results in a formatted table.
 * @param result - Test results from TestService.
 * @param args - CLI arguments for display options.
 * @param cliOutput - CLI output service.
 */
const displayTestResults = (
  result: TestResult,
  args: Record<string, unknown>,
  cliOutput: CliOutputService
): void => {
  if (result.success) {
    cliOutput.success(`✅ All tests passed! ${result.passedTests}/${result.totalTests} tests successful`);
  } else {
    cliOutput.error(`❌ ${result.failedTests} tests failed, ${result.passedTests} tests passed (${result.totalTests} total)`);
  }

  if (result.suites.length > 0) {
    const maxValue = typeof args.max === 'string' || typeof args.max === 'number'
      ? args.max
      : '10';
    const maxDisplay = parseInt(String(maxValue), 10);

    cliOutput.output('', { format: 'text' });
    cliOutput.output(
      'Test Suite                                                   | Status | Tests | Duration',
      { format: 'text' }
    );
    cliOutput.output(
      '-------------------------------------------------------------|--------|-------|----------',
      { format: 'text' }
    );

    const displaySuites = result.suites.slice(0, maxDisplay);
    for (const suite of displaySuites) {
      const nameDisplay = suite.name.padEnd(60, ' ').substring(0, 60);
      const statusDisplay = suite.status === 'passed' ? '  ✅   ' : '  ❌   ';
      const testsDisplay = String(suite.tests).padStart(5, ' ');
      const durationDisplay = `${String(suite.duration)}ms`.padStart(8, ' ');

      cliOutput.output(
        `${nameDisplay} | ${statusDisplay} | ${testsDisplay} | ${durationDisplay}`,
        { format: 'text' }
      );
    }

    if (result.suites.length > maxDisplay) {
      cliOutput.output('', { format: 'text' });
      cliOutput.output(
        `... and ${String(result.suites.length - maxDisplay)} more test suites`,
        { format: 'text' }
      );
    }
  }

  if (result.coverage && Object.keys(result.coverage).length > 0) {
    cliOutput.output('', { format: 'text' });
    cliOutput.info('📊 Test Coverage Summary:');

    if (result.coverage.statements !== undefined) {
      cliOutput.output(`   Statements: ${result.coverage.statements.toFixed(1)}%`, { format: 'text' });
    }
    if (result.coverage.branches !== undefined) {
      cliOutput.output(`   Branches:   ${result.coverage.branches.toFixed(1)}%`, { format: 'text' });
    }
    if (result.coverage.functions !== undefined) {
      cliOutput.output(`   Functions:  ${result.coverage.functions.toFixed(1)}%`, { format: 'text' });
    }
    if (result.coverage.lines !== undefined) {
      cliOutput.output(`   Lines:      ${result.coverage.lines.toFixed(1)}%`, { format: 'text' });
    }
  }

  cliOutput.output('', { format: 'text' });
  const suiteSummary = `Test Suites: ${result.passedTestSuites} passed, ${result.failedTestSuites} failed, ${result.totalTestSuites} total`;
  const testSummary = `Tests:       ${result.passedTests} passed, ${result.failedTests} failed, ${result.totalTests} total`;

  cliOutput.output(suiteSummary, { format: 'text' });
  cliOutput.output(testSummary, { format: 'text' });
};

/**
 * Execute integration test command.
 * @param context - CLI context.
 */
const executeIntegrationTest = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();

  try {
    cliOutput.info('🧪 Running integration tests...');
    cliOutput.output('', { format: 'text' });

    const testService = TestService.getInstance();
    testService.initialize();

    const result = await testService.runIntegrationTests();
    displayTestResults(result, args, cliOutput);

    if (!result.success && result.failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(
      LogSource.CLI,
      `Error running integration tests: ${error instanceof Error ? error.message : String(error)}`
    );
    cliOutput.error(`Error running integration tests: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export const command: ICLICommand = {
  description: 'Run integration tests and display test coverage summary',
  options: [
    {
      name: 'max',
      alias: 'm',
      type: 'string',
      description: 'Maximum number of test suites to display',
      default: '10'
    }
  ],
  execute: executeIntegrationTest
};

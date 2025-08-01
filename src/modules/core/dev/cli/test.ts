/**
 * Test command - runs integration tests and displays test coverage summary.
 */

import { randomUUID } from 'crypto';
import type { ICLICommand, ICLIContext } from '@/modules/core/cli/types/manual';
import { CliOutputService } from '@/modules/core/cli/services/cli-output.service';
import { LoggerService } from '@/modules/core/logger/services/logger.service';
import { LogSource } from '@/modules/core/logger/types/manual';
import { TestService } from '@/modules/core/dev/services/test.service';
import type { TestResult } from '@/modules/core/dev/services/test.service';
import { EventBusService } from '@/modules/core/events/services/events.service';
import { DevEvents } from '@/modules/core/events/types/manual';

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
 * Execute test command.
 * @param context - CLI context.
 */
const executeTest = async (context: ICLIContext): Promise<void> => {
  const { args } = context;
  const cliOutput = CliOutputService.getInstance();
  const logger = LoggerService.getInstance();
  const startTime = Date.now();

  try {
    const module = args.module as string | undefined;
    let target = args.target as string | undefined;
    const isUnit = Boolean(args.unit);
    const isIntegration = Boolean(args.integration);
    const withCoverage = Boolean(args.coverage);

    if (module && !target) {
      if (isUnit) {
        target = `tests/unit/modules/core/${module}`;
      } else if (isIntegration) {
        target = `tests/integration/modules/core/${module}`;
      } else {
        target = `tests/integration/modules/core/${module}`;
        cliOutput.info('💡 Tip: Use --unit or --integration to run specific test types');
      }
    } else if (!module && !target) {
      cliOutput.warning('⚠️  No module or target specified. Running all tests can take a long time.');
      cliOutput.info('💡 Tip: Use --module <name> to test a specific module');
      cliOutput.info('   Example: ./bin/systemprompt dev test --module users');
      return;
    }

    const testType = isUnit ? 'unit' : isIntegration ? 'integration' : 'all';
    const targetInfo = module ? ` for ${module} module` : target ? ` for ${target}` : '';

    cliOutput.info(`🧪 Running ${testType} tests${targetInfo}...`);
    cliOutput.output('', { format: 'text' });

    const testService = TestService.getInstance();
    testService.initialize();

    const result = await testService.runTests(target, {
      unit: isUnit,
      integration: isIntegration,
      coverage: withCoverage
    });
    const duration = Date.now() - startTime;

    if (args.format === 'json') {
      const jsonResult = {
        module,
        target,
        testType,
        timestamp: new Date().toISOString(),
        duration,
        success: result.success,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        totalTestSuites: result.totalTestSuites,
        passedTestSuites: result.passedTestSuites,
        failedTestSuites: result.failedTestSuites,
        coverage: result.coverage,
        suites: result.suites
      };
      cliOutput.json(jsonResult);
    } else {
      displayTestResults(result, args, cliOutput);
    }

    const { ReportWriterService } = await import('@/modules/core/dev/services/report-writer.service');
    ReportWriterService.getInstance();

    const eventBus = EventBusService.getInstance();
    eventBus.emit(DevEvents.REPORT_WRITE_REQUEST, {
      requestId: randomUUID(),
      report: {
        timestamp: new Date().toISOString(),
        command: 'test' as const,
        module,
        target,
        success: result.success,
        duration,
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        totalTestSuites: result.totalTestSuites,
        passedTestSuites: result.passedTestSuites,
        failedTestSuites: result.failedTestSuites,
        coverage: result.coverage ? {
          statements: result.coverage.statements,
          branches: result.coverage.branches,
          functions: result.coverage.functions,
          lines: result.coverage.lines
        } : undefined,
        suites: result.suites.map(suite => { return {
          name: suite.name,
          status: suite.status,
          tests: suite.tests,
          duration: suite.duration
        } })
      }
    });

    if (!result.success && result.failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error(
      LogSource.CLI,
      `Error running tests: ${error instanceof Error ? error.message : String(error)}`
    );
    cliOutput.error(`Error running tests: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export const command: ICLICommand = {
  description: 'Run tests and display test coverage summary',
  options: [
    {
      name: 'module',
      alias: 'm',
      type: 'string',
      description: 'Module name to test (e.g., users, auth, logger)'
    },
    {
      name: 'target',
      alias: 't',
      type: 'string',
      description: 'Target file or folder to test (e.g., src/modules/core/users)'
    },
    {
      name: 'unit',
      alias: 'u',
      type: 'boolean',
      description: 'Run only unit tests',
      default: false
    },
    {
      name: 'integration',
      alias: 'i',
      type: 'boolean',
      description: 'Run only integration tests',
      default: false
    },
    {
      name: 'coverage',
      alias: 'c',
      type: 'boolean',
      description: 'Generate and display coverage report',
      default: false
    },
    {
      name: 'max',
      type: 'string',
      description: 'Maximum number of test suites to display',
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
  execute: executeTest
};

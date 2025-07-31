/**
 * Test service for running integration tests and parsing results.
 * @file Test service for running integration tests and parsing results.
 * @module modules/core/dev/services/test
 */

import { spawn } from 'child_process';
import type { ILogger } from '@/modules/core/logger/types/index';
import { LogSource } from '@/modules/core/logger/types/index';
import { LoggerService } from '@/modules/core/logger/services/logger.service';

/**
 * Test result interface.
 */
export interface TestResult {
  success: boolean;
  totalTestSuites: number;
  passedTestSuites: number;
  failedTestSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: {
    statements?: number;
    branches?: number;
    functions?: number;
    lines?: number;
  };
  suites: Array<{
    name: string;
    status: 'passed' | 'failed';
    tests: number;
    passed: number;
    failed: number;
    duration: number;
  }>;
}

/**
 * Service for running integration tests and parsing results.
 */
export class TestService {
  private static instance: TestService;
  private logger!: ILogger;
  private initialized = false;

  /**
   * Private constructor for singleton pattern.
   */
  private constructor() {}

  /**
   * Get singleton instance.
   * @returns TestService instance.
   */
  public static getInstance(): TestService {
    TestService.instance ??= new TestService();
    return TestService.instance;
  }

  /**
   * Initialize the service.
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.logger = LoggerService.getInstance();
    this.initialized = true;
    this.logger.info(LogSource.CLI, 'TestService initialized');
  }

  /**
   * Run tests for a specific file or folder.
   * @param target - File or folder path to test.
   * @param options - Test options.
   * @param options.unit
   * @param options.integration
   * @param options.coverage
   * @returns Promise resolving to test results.
   */
  public async runTests(target?: string, options: { unit?: boolean; integration?: boolean; coverage?: boolean } = {}): Promise<TestResult> {
    const testType = options.unit ? 'unit' : options.integration ? 'integration' : 'all';
    const targetInfo = target ? ` for ${target}` : '';
    const withCoverage = options.coverage ? ' with coverage' : '';

    this.logger.info(LogSource.CLI, `Running ${testType} tests${targetInfo}${withCoverage}`);

    return await new Promise((resolve, reject) => {
      const testCommand = 'npm';
      const testArgs: string[] = ['run'];

      if (testType === 'unit') {
        testArgs.push(options.coverage ? 'test:coverage' : 'test:unit');
      } else if (testType === 'integration') {
        testArgs.push(options.coverage ? 'test:integration:report' : 'test:integration');
      } else {
        testArgs.push('test');
      }

      if (options.coverage) {
        testArgs.push('--');
        testArgs.push('--coverage');
      }

      if (target) {
        if (!options.coverage) {
          testArgs.push('--');
        }
        testArgs.push(target);
      }

      const testProcess = spawn(testCommand, testArgs, {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      testProcess.on('close', (code) => {
        try {
          const result = this.parseTestOutput(stdout, stderr, code);
          this.logger.info(LogSource.CLI, `Tests completed: ${result.passedTests}/${result.totalTests} tests passed`);
          resolve(result);
        } catch (error) {
          this.logger.error(LogSource.CLI, `Failed to parse test output: ${error instanceof Error ? error.message : String(error)}`);
          reject(error);
        }
      });

      testProcess.on('error', (error) => {
        this.logger.error(LogSource.CLI, `Test process error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Parse test output from Vitest.
   * @param stdout - Standard output from test runner.
   * @param stderr - Standard error from test runner.
   * @param exitCode - Exit code from test process.
   * @returns Parsed test results.
   */
  private parseTestOutput(stdout: string, stderr: string, exitCode: number | null): TestResult {
    const output = stdout + stderr;

    const result: TestResult = {
      success: exitCode === 0,
      totalTestSuites: 0,
      passedTestSuites: 0,
      failedTestSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      coverage: {},
      suites: []
    };

    const lines = output.split('\n');

    for (const line of lines) {
      const suiteMatch = line.match(/([✓×])\s+\|integration\|\s+([^(]+)\s+\((\d+)\s+tests?\)\s+(\d+)ms/);
      if (suiteMatch) {
        const [, status, suiteName, testCount, duration] = suiteMatch;
        const tests = parseInt(testCount!, 10);
        const isPassed = status === '✓';

        result.suites.push({
          name: suiteName!.trim(),
          status: isPassed ? 'passed' : 'failed',
          tests,
          passed: isPassed ? tests : 0,
          failed: isPassed ? 0 : tests,
          duration: parseInt(duration!, 10)
        });

        result.totalTestSuites++;
        if (isPassed) {
          result.passedTestSuites++;
        } else {
          result.failedTestSuites++;
        }
      }
    }

    const testFilesMatch = output.match(/Test Files\s+(\d+)\s+passed\s+\((\d+)\)/);
    if (testFilesMatch) {
      result.passedTestSuites = parseInt(testFilesMatch[1]!, 10);
      result.totalTestSuites = parseInt(testFilesMatch[2]!, 10);
      result.failedTestSuites = result.totalTestSuites - result.passedTestSuites;
    }

    const testsMatch = output.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/);
    if (testsMatch) {
      result.passedTests = parseInt(testsMatch[1]!, 10);
      result.totalTests = parseInt(testsMatch[2]!, 10);
      result.failedTests = result.totalTests - result.passedTests;
    }

    const failedTestsMatch = output.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/);
    if (failedTestsMatch) {
      result.failedTests = parseInt(failedTestsMatch[1]!, 10);
      result.passedTests = parseInt(failedTestsMatch[2]!, 10);
      result.totalTests = parseInt(failedTestsMatch[3]!, 10);
    }

    const coverageTableRegex = /^(.+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/gm;
    let match;
    let hasCoverage = false;

    while ((match = coverageTableRegex.exec(output)) !== null) {
      const filename = match[1]!.trim();
      if (filename === 'All files' || filename.includes('All files')) {
        result.coverage = {
          statements: parseFloat(match[2]!),
          branches: parseFloat(match[3]!),
          functions: parseFloat(match[4]!),
          lines: parseFloat(match[5]!)
        };
        hasCoverage = true;
      }
    }

    if (!hasCoverage) {
      const altCoverageMatch = output.match(/Coverage summary[\s\S]*?Statements\s*:\s*([\d.]+)%[\s\S]*?Branches\s*:\s*([\d.]+)%[\s\S]*?Functions\s*:\s*([\d.]+)%[\s\S]*?Lines\s*:\s*([\d.]+)%/);
      if (altCoverageMatch) {
        result.coverage = {
          statements: parseFloat(altCoverageMatch[1]!),
          branches: parseFloat(altCoverageMatch[2]!),
          functions: parseFloat(altCoverageMatch[3]!),
          lines: parseFloat(altCoverageMatch[4]!)
        };
      }
    }

    if (result.suites.length === 0 && result.totalTestSuites > 0) {
      if (result.passedTestSuites > 0) {
        result.suites.push({
          name: 'Passed Test Suites',
          status: 'passed',
          tests: Math.floor(result.passedTests / result.passedTestSuites) || result.passedTests,
          passed: result.passedTests,
          failed: 0,
          duration: 0
        });
      }

      if (result.failedTestSuites > 0) {
        result.suites.push({
          name: 'Failed Test Suites',
          status: 'failed',
          tests: Math.floor(result.failedTests / result.failedTestSuites) || result.failedTests,
          passed: 0,
          failed: result.failedTests,
          duration: 0
        });
      }
    }

    return result;
  }

  /**
   * Run integration tests and return parsed results.
   * @returns Promise resolving to test results.
   */
  public async runIntegrationTests(): Promise<TestResult> {
    return await this.runTests(undefined, { integration: true });
  }
}

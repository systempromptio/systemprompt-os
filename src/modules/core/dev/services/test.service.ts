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
   * Run integration tests and return parsed results.
   * @returns Promise resolving to test results.
   */
  public async runIntegrationTests(): Promise<TestResult> {
    this.logger.info(LogSource.CLI, 'Running integration tests');

    return await new Promise((resolve, reject) => {
      const testProcess = spawn('npm', ['run', 'test:integration'], {
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
          this.logger.info(LogSource.CLI, `Integration tests completed: ${result.passedTests}/${result.totalTests} tests passed`);
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
        const tests = parseInt(testCount, 10);
        const isPassed = status === '✓';

        result.suites.push({
          name: suiteName.trim(),
          status: isPassed ? 'passed' : 'failed',
          tests,
          passed: isPassed ? tests : 0,
          failed: isPassed ? 0 : tests,
          duration: parseInt(duration, 10)
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
      result.passedTestSuites = parseInt(testFilesMatch[1], 10);
      result.totalTestSuites = parseInt(testFilesMatch[2], 10);
      result.failedTestSuites = result.totalTestSuites - result.passedTestSuites;
    }

    const testsMatch = output.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/);
    if (testsMatch) {
      result.passedTests = parseInt(testsMatch[1], 10);
      result.totalTests = parseInt(testsMatch[2], 10);
      result.failedTests = result.totalTests - result.passedTests;
    }

    const failedTestsMatch = output.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed\s+\((\d+)\)/);
    if (failedTestsMatch) {
      result.failedTests = parseInt(failedTestsMatch[1], 10);
      result.passedTests = parseInt(failedTestsMatch[2], 10);
      result.totalTests = parseInt(failedTestsMatch[3], 10);
    }

    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      result.coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
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
}

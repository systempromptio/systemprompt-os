import type { Reporter, File, TaskResultPack } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface DomainResult {
  domain: string;
  tests: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface E2ETestReport {
  timestamp: string;
  totalDuration: number;
  success: boolean;
  domains: DomainResult[];
  summary: {
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
  };
}

export default class E2EJsonReporter implements Reporter {
  private results: E2ETestReport = {
    timestamp: new Date().toISOString(),
    totalDuration: 0,
    success: true,
    domains: [],
    summary: {
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalSkipped: 0
    }
  };

  onFinished(files?: File[], errors?: unknown[]): void {
    if (!files) return;

    const startTime = Date.now();

    // Process each test file (domain)
    files.forEach(file => {
      if (!file.tasks || file.tasks.length === 0) return;

      // Extract domain name from filename (e.g., "00-tools-cli.e2e.test.ts" -> "tools-cli")
      const domainMatch = file.name.match(/\d+-(.+?)\.e2e\.test/);
      const domainName = domainMatch ? domainMatch[1] : 'unknown';

      const domainResult: DomainResult = {
        domain: domainName,
        tests: [],
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      };

      // Process each test suite in the file
      const processTask = (task: TaskResultPack) => {
        if (task.type === 'test') {
          const testResult: TestResult = {
            name: task.name,
            status: task.result?.state === 'pass' ? 'passed' : 
                   task.result?.state === 'fail' ? 'failed' : 'skipped',
            duration: task.result?.duration || 0
          };

          if (task.result?.state === 'fail' && task.result.errors && task.result.errors.length > 0) {
            testResult.error = task.result.errors[0]?.message || 'Unknown error';
          }

          domainResult.tests.push(testResult);
          domainResult.totalTests++;
          domainResult.duration += testResult.duration;

          if (testResult.status === 'passed') domainResult.passed++;
          else if (testResult.status === 'failed') domainResult.failed++;
          else domainResult.skipped++;
        }

        // Recursively process nested tasks
        if (task.tasks) {
          task.tasks.forEach(processTask);
        }
      };

      file.tasks.forEach(processTask);

      if (domainResult.totalTests > 0) {
        this.results.domains.push(domainResult);
        this.results.summary.totalTests += domainResult.totalTests;
        this.results.summary.totalPassed += domainResult.passed;
        this.results.summary.totalFailed += domainResult.failed;
        this.results.summary.totalSkipped += domainResult.skipped;
        
        if (domainResult.failed > 0) {
          this.results.success = false;
        }
      }
    });

    // Calculate total duration
    this.results.totalDuration = Date.now() - startTime;

    // Add any global errors
    if (errors && errors.length > 0) {
      this.results.success = false;
    }

    // Save results to JSON file
    this.saveResults();
  }

  private saveResults(): void {
    try {
      // Create timestamp for filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `e2e-test-${timestamp}.json`;
      
      // Ensure state/temp directory exists
      const tempDir = join(process.cwd(), 'state', 'temp');
      mkdirSync(tempDir, { recursive: true });
      
      // Write results to file
      const filepath = join(tempDir, filename);
      writeFileSync(filepath, JSON.stringify(this.results, null, 2));
      
      // Also create a symlink to latest results
      const latestPath = join(tempDir, 'e2e-test-latest.json');
      try {
        // Remove existing symlink if it exists
        const fs = require('fs');
        if (fs.existsSync(latestPath)) {
          fs.unlinkSync(latestPath);
        }
        fs.symlinkSync(filename, latestPath);
      } catch (e) {
        // Symlink creation might fail on some systems, that's ok
      }
      
      console.log(`\n📊 Test results saved to: ${filepath}`);
      console.log(`📊 Latest results link: ${latestPath}`);
      
      // Print summary
      console.log('\n📈 Test Summary:');
      console.log(`   Total Tests: ${this.results.summary.totalTests}`);
      console.log(`   ✅ Passed: ${this.results.summary.totalPassed}`);
      console.log(`   ❌ Failed: ${this.results.summary.totalFailed}`);
      console.log(`   ⏭️  Skipped: ${this.results.summary.totalSkipped}`);
      console.log(`   ⏱️  Duration: ${(this.results.totalDuration / 1000).toFixed(2)}s`);
      console.log(`   ${this.results.success ? '✅ All tests passed!' : '❌ Some tests failed!'}`);
    } catch (error) {
      console.error('Failed to save test results:', error);
    }
  }
}